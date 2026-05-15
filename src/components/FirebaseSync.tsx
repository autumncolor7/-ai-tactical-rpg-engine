import React, { useContext, useEffect, useState } from 'react';
import { auth, db, googleProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, doc, getDoc, setDoc, deleteDoc, collection, onSnapshot, OperationType, handleFirestoreError } from '../firebase';
import { GameContext, Entity, Item, CHARACTER_POOL } from '../context/GameContext';

export default function FirebaseSync() {
  const { state, dispatch } = useContext(GameContext);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const isOfflineUser = state.user?.uid === 'local-guest';
  const stateRef = React.useRef(state);
  const hasLoadedTeamRef = React.useRef(false);
  
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const enterLocalGuestMode = (reason?: string) => {
    if (reason) {
      setAuthError(reason);
    }
    window.localStorage.setItem('terraBattle.localGuest', '1');

    const allChars = CHARACTER_POOL.map((c, idx) => ({ ...c, x: 1 + (idx % 3), y: 1 + Math.floor(idx / 3) }));
    const team = allChars.slice(0, 3).map((c, idx) => ({ ...c, x: 1, y: 1 + idx }));
    const backpack: Item[] = [
      { id: 'local_potion_1', name: 'Small Potion', description: 'Recover 30 HP', type: 'HEAL', value: 30, icon: '🧪' },
      { id: 'local_potion_2', name: 'Large Potion', description: 'Recover 80 HP', type: 'HEAL', value: 80, icon: '🧴' }
    ];

    hasLoadedTeamRef.current = true;
    dispatch({
      type: 'SET_USER',
      payload: { uid: 'local-guest', displayName: 'Guest', level: 1, exp: 0, gold: 0 }
    });
    dispatch({ type: 'SET_STAGE', payload: 1 });
    dispatch({ type: 'SET_ALL_CHARACTERS', payload: allChars });
    dispatch({ type: 'SET_TEAM', payload: team });
    dispatch({ type: 'SET_BACKPACK', payload: backpack });
  };

  // Handle Auth State
  useEffect(() => {
    if (window.localStorage.getItem('terraBattle.localGuest') === '1') {
      enterLocalGuestMode();
      return;
    }

    getRedirectResult(auth)
      .then((result) => {
        const pendingGoogle = window.localStorage.getItem('terraBattle.googleRedirectPending') === '1';
        if (result?.user) {
          window.localStorage.removeItem('terraBattle.googleRedirectPending');
          return;
        }
        if (pendingGoogle) {
          setAuthError('google-redirect-returned-no-user');
          window.localStorage.removeItem('terraBattle.googleRedirectPending');
        }
      })
      .catch((error: any) => {
        if (error?.code) setAuthError(error.code);
        window.localStorage.removeItem('terraBattle.googleRedirectPending');
      });

    console.log("FirebaseSync: Setting up onAuthStateChanged");
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log("FirebaseSync: onAuthStateChanged fired, user:", user?.uid);
      if (user) {
        // Load initial data from Firestore
        await loadUserData(user.uid);
      } else {
        if (!stateRef.current.user || stateRef.current.user.uid !== 'local-guest') {
          dispatch({ type: 'SET_USER', payload: null });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const loadUserData = async (userId: string) => {
    console.log("FirebaseSync: Loading user data for:", userId);
    try {
      // 1. Load User Profile
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        console.log("FirebaseSync: Creating new user profile");
        const newUser = {
          uid: userId,
          displayName: auth.currentUser?.displayName || 'Adventurer',
          email: auth.currentUser?.email || '',
          photoURL: auth.currentUser?.photoURL || '',
          createdAt: new Date().toISOString(),
          stage: 1,
          gold: 0,
          level: 1,
          exp: 0,
          team_ids: CHARACTER_POOL.slice(0, 3).map(c => c.id)
        };
        // Initialize new user in Firestore
        await setDoc(userRef, newUser).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${userId}`));
        
        // Initialize characters subcollection
        console.log("FirebaseSync: Initializing characters for new user");
        for (const char of CHARACTER_POOL) {
          await setDoc(doc(db, 'users', userId, 'characters', char.id), char).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${userId}/characters/${char.id}`));
        }

        // Initialize backpack with some items
        console.log("FirebaseSync: Initializing backpack for new user");
        const initialItems = [
          { id: 'item_potion_1', name: 'Small Potion', description: 'Recover 30 HP', type: 'HEAL', value: 30, icon: '🧪' },
          { id: 'item_potion_2', name: 'Large Potion', description: 'Recover 80 HP', type: 'HEAL', value: 80, icon: '🧴' }
        ];
        for (const item of initialItems) {
          await setDoc(doc(db, 'users', userId, 'backpack', item.id), item).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${userId}/backpack/${item.id}`));
        }

        dispatch({ type: 'SET_USER', payload: { ...newUser, photoURL: newUser.photoURL || undefined } });
      } else {
        console.log("FirebaseSync: User profile exists, loading data");
        const userData = userSnap.data();
        dispatch({ type: 'SET_STAGE', payload: userData.stage || 1 });
        dispatch({ 
          type: 'SET_USER', 
          payload: { 
            uid: userId, 
            displayName: userData.displayName || 'Adventurer', 
            level: userData.level || 1, 
            exp: userData.exp || 0, 
            gold: userData.gold || 0,
            photoURL: userData.photoURL || undefined
          } 
        });
      }

      // 2. Load Characters (Real-time)
      const charCol = collection(db, 'users', userId, 'characters');
      onSnapshot(charCol, async (snapshot) => {
        let characters: Entity[] = [];
        const existingIds = new Set<string>();
        
        snapshot.forEach((doc) => {
          const data = doc.data() as Entity;
          characters.push({ id: doc.id, ...data });
          existingIds.add(doc.id);
        });

        // Check if any pool characters are missing (ensure user has all 6 initial heroes)
        const missingFromPool = CHARACTER_POOL.filter(p => !existingIds.has(p.id));
        if (missingFromPool.length > 0) {
          for (const char of missingFromPool) {
            await setDoc(doc(db, 'users', userId, 'characters', char.id), char).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${userId}/characters/${char.id}`));
          }
          // The next snapshot will handle the dispatch with the full list
          return;
        }

        dispatch({ type: 'SET_ALL_CHARACTERS', payload: characters });
        
        if (!hasLoadedTeamRef.current) {
          hasLoadedTeamRef.current = true;
          // Load team from user data if available
          const userRef = doc(db, 'users', userId);
          getDoc(userRef).then(snap => {
            if (snap.exists()) {
              const userData = snap.data();
              if (userData.team_ids) {
                const teamMembers = characters.filter(c => userData.team_ids.includes(c.id));
                // Sort team members based on the order in team_ids
                const sortedTeam = userData.team_ids
                  .map((id: string) => teamMembers.find(c => c.id === id))
                  .filter(Boolean) as Entity[];
                
                dispatch({ type: 'SET_TEAM', payload: sortedTeam });
              } else if (stateRef.current.player_state.team.length === 0 && characters.length > 0) {
                // Only auto-fill on initial load if team_ids is completely missing
                const availableSlots = stateRef.current.stage === 1 ? 3 : (stateRef.current.stage < 4 ? 4 : (stateRef.current.stage < 6 ? 5 : 6));
                dispatch({ type: 'SET_TEAM', payload: characters.slice(0, availableSlots) });
              }
            }
          });
        } else {
          // Update existing team members' data (exp, level, etc.) without changing composition
          const currentTeamIds = stateRef.current.player_state.team.map(c => c.id);
          const updatedTeam = currentTeamIds
            .map(id => characters.find(c => c.id === id))
            .filter(Boolean) as Entity[];
          
          // Only dispatch if the team actually has members to avoid clearing it accidentally
          if (updatedTeam.length > 0) {
            dispatch({ type: 'SET_TEAM', payload: updatedTeam });
          }
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${userId}/characters`);
      });

      // 3. Load Backpack (Real-time)
      const backpackCol = collection(db, 'users', userId, 'backpack');
      onSnapshot(backpackCol, (snapshot) => {
        const items: Item[] = [];
        snapshot.forEach((doc) => {
          items.push({ id: doc.id, ...doc.data() } as Item);
        });
        dispatch({ type: 'SET_BACKPACK', payload: items });
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${userId}/backpack`);
      });

      setIsInitialLoad(false);
    } catch (error) {
      console.error("FirebaseSync: Error loading user data:", error);
      enterLocalGuestMode(error instanceof Error ? error.message : 'firestore-load-failed');
    }
  };

  const handleGoogleLogin = async () => {
    setAuthError(null);
    window.localStorage.removeItem('terraBattle.localGuest');
    const fallbackToRedirectErrors = new Set([
      'auth/operation-not-supported-in-this-environment',
      'auth/popup-blocked',
      'auth/cancelled-popup-request'
    ]);

    try {
      await signInWithPopup(auth, googleProvider);
      window.localStorage.removeItem('terraBattle.googleRedirectPending');
    } catch (error: any) {
      const errorCode = error?.code || 'google-signin-failed';
      console.error("Google popup sign-in failed:", error);

      if (fallbackToRedirectErrors.has(errorCode)) {
        try {
          window.localStorage.setItem('terraBattle.googleRedirectPending', '1');
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectError: any) {
          console.error("Google redirect sign-in failed:", redirectError);
          setAuthError(redirectError?.code || errorCode);
          window.localStorage.removeItem('terraBattle.googleRedirectPending');
          return;
        }
      }

      setAuthError(errorCode);
      window.localStorage.removeItem('terraBattle.googleRedirectPending');
    }
  };

  const handleGuestLogin = async () => {
    setAuthError(null);
    enterLocalGuestMode();
  };

  const handleOfflineMode = () => {
    enterLocalGuestMode();
  };

  // Sync backpack changes back to Firestore
  const prevBackpackRef = React.useRef<Item[]>([]);
  useEffect(() => {
    if (state.user && !isOfflineUser) {
      const userId = state.user.uid;
      const currentIds = new Set<string>(state.player_state.backpack.map(i => i.id));
      const prevIds = new Set<string>(prevBackpackRef.current.map(i => i.id));
      
      // Find deleted items
      const deletedIds = [...prevIds].filter(id => !currentIds.has(id));
      deletedIds.forEach(id => {
        const itemRef = doc(db, 'users', userId, 'backpack', id);
        deleteDoc(itemRef).catch(err => handleFirestoreError(err, OperationType.DELETE, `users/${userId}/backpack/${id}`));
      });

      // Find new or updated items
      state.player_state.backpack.forEach(item => {
        const itemRef = doc(db, 'users', userId, 'backpack', item.id);
        setDoc(itemRef, item, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${userId}/backpack/${item.id}`));
      });

      prevBackpackRef.current = state.player_state.backpack;
    }
  }, [state.player_state.backpack, state.user?.uid]);

  // Sync character changes back to Firestore
  const lastSyncedCharsRef = React.useRef<string>('');
  useEffect(() => {
    if (state.user && !isOfflineUser && state.player_state.all_characters.length > 0) {
      const userId = state.user.uid;
      
      // Create a stable key for checking if meaningful data changed
      const currentSyncKey = state.player_state.all_characters.map(c => 
        `${c.id}:${c.level}:${c.exp}:${c.sp}:${c.sb}:${JSON.stringify(c.equipped_skills)}`
      ).join('|');

      if (lastSyncedCharsRef.current === currentSyncKey) return;
      lastSyncedCharsRef.current = currentSyncKey;

      state.player_state.all_characters.forEach(char => {
        const charRef = doc(db, 'users', userId, 'characters', char.id);
        getDoc(charRef).then(snap => {
          if (snap.exists()) {
            const currentData = snap.data();
            const hasChanged = currentData.level !== char.level ||
                              currentData.exp !== char.exp ||
                              currentData.sp !== char.sp ||
                              currentData.sb !== char.sb ||
                              JSON.stringify(currentData.equipped_skills) !== JSON.stringify(char.equipped_skills);
            
            if (hasChanged) {
              setDoc(charRef, char, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${userId}/characters/${char.id}`));
            }
          } else {
            // New character added to the team
            setDoc(charRef, char).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${userId}/characters/${char.id}`));
          }
        });
      });
    }
  }, [state.player_state.all_characters, state.user?.uid]);

  // Sync user progress back to Firestore
  const lastSyncedProgressRef = React.useRef<string>('');
  useEffect(() => {
    if (state.user && !isOfflineUser) {
      const userRef = doc(db, 'users', state.user.uid);
      const updateData = {
        stage: state.stage,
        gold: state.user.gold,
        level: state.user.level,
        exp: state.user.exp
      };
      
      const currentSyncKey = JSON.stringify(updateData);
      if (lastSyncedProgressRef.current === currentSyncKey) return;
      lastSyncedProgressRef.current = currentSyncKey;

      getDoc(userRef).then(snap => {
        if (snap.exists()) {
          const currentData = snap.data();
          const hasChanged = currentData.stage !== updateData.stage ||
                            currentData.gold !== updateData.gold ||
                            currentData.level !== updateData.level ||
                            currentData.exp !== updateData.exp;
          
          if (hasChanged) {
            setDoc(userRef, updateData, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${state.user?.uid}`));
          }
        }
      });
    }
  }, [state.stage, state.user?.gold, state.user?.level, state.user?.exp, state.user?.uid]);

  // Sync team changes back to Firestore
  const lastSyncedTeamRef = React.useRef<string>('');
  useEffect(() => {
    if (state.user && !isOfflineUser && hasLoadedTeamRef.current && state.player_state.team.length > 0) {
      const userRef = doc(db, 'users', state.user.uid);
      const teamIds = state.player_state.team.map(m => m.id);
      
      const currentSyncKey = JSON.stringify(teamIds);
      if (lastSyncedTeamRef.current === currentSyncKey) return;
      lastSyncedTeamRef.current = currentSyncKey;

      getDoc(userRef).then(snap => {
        if (snap.exists()) {
          const currentTeamIds = snap.data().team_ids || [];
          if (JSON.stringify(currentTeamIds) !== JSON.stringify(teamIds)) {
            setDoc(userRef, { team_ids: teamIds }, { merge: true }).catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${state.user?.uid}`));
          }
        }
      });
    }
  }, [state.player_state.team, state.user?.uid]);

  // If user is undefined, we are still checking auth state
  if (state.user === undefined) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[1000]">
        <div className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-yellow-500 font-bold tracking-widest uppercase text-xs">Loading Adventure...</p>
      </div>
    );
  }

  // If user is null, show login screen
  if (state.user === null) {
    return (
      <div className="fixed inset-0 bg-black flex flex-col items-center justify-center z-[1000] p-6 text-center">
        <h1 className="text-4xl font-bold text-yellow-500 mb-8 tracking-tighter">TERRA BATTLE CLONE</h1>
        <button 
          onClick={handleGoogleLogin}
          className="px-8 py-4 bg-white text-black font-bold rounded-full uppercase tracking-widest hover:bg-zinc-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.2)]"
        >
          Sign in with Google
        </button>
        <button
          onClick={handleGuestLogin}
          className="mt-3 px-8 py-3 bg-zinc-800 text-zinc-100 font-bold rounded-full uppercase tracking-widest hover:bg-zinc-700 transition-colors border border-zinc-600"
        >
          Continue as Guest
        </button>
        <button
          onClick={handleOfflineMode}
          className="mt-3 px-8 py-3 bg-zinc-900 text-zinc-100 font-bold rounded-full uppercase tracking-widest hover:bg-zinc-800 transition-colors border border-zinc-500"
        >
          Offline Mode
        </button>
        {authError && <p className="mt-4 text-red-400 text-xs">Login error: {authError}</p>}
        <p className="mt-8 text-zinc-500 text-xs">If Firebase auth is blocked, use Offline Mode.</p>
      </div>
    );
  }

  return null;
}

