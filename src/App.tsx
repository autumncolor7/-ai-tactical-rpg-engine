import React, { useContext, useState, useEffect, useMemo } from 'react';
import { GameProvider, GameContext, Entity, generateId, Item, Skill, JobType, calculateTriggerRate, getExpToNextLevel } from './context/GameContext';
import BattleGrid from './components/BattleGrid';
import SkillManagement from './components/SkillManagement';
import FirebaseSync from './components/FirebaseSync';
import LevelUpOverlay from './components/LevelUpOverlay';
import { motion, AnimatePresence } from 'motion/react';
import { generateMap, getNPCDialogueResponse, generateCharacterSkills } from './services/geminiService';
import { STAGE_THEMES } from './constants/stageThemes';
import { auth, signOut } from './firebase';

function DialogueOverlay() {
  const { state, dispatch } = useContext(GameContext);
  const [input, setInput] = useState('');
  const dialogue = state.active_dialogue;

  if (!dialogue) return null;

  const handleSend = async (text: string) => {
    if (dialogue.is_loading) return;
    const playerInput = text || '你好';
    if (text) {
      dispatch({ type: 'UPDATE_DIALOGUE', payload: { role: 'player', content: text } });
    }
    setInput('');
    dispatch({ type: 'SET_DIALOGUE_LOADING', payload: true });

    try {
      const response = await getNPCDialogueResponse(dialogue.npc, dialogue.messages, playerInput);
      
      dispatch({ type: 'SET_DIALOGUE_LOADING', payload: false });
      dispatch({ type: 'UPDATE_DIALOGUE', payload: { role: 'npc', content: response.response } });
      dispatch({ type: 'LOG_MESSAGE', payload: response.log });

      if (response.action === 'START_BATTLE') {
        setTimeout(() => {
          dispatch({ type: 'TRIGGER_BATTLE', payload: { encounterId: dialogue.npc.id, battle_config: { ...response.battle_config, enemy_entity: dialogue.npc } } });
          dispatch({ type: 'END_DIALOGUE' });
        }, 1500);
      } else if (response.action === 'JOIN_TEAM') {
        const avgLevel = Math.max(1, Math.floor(state.player_state.team.reduce((sum, p) => sum + p.level, 0) / state.player_state.team.length));
        
        const newSkills = response.npc_skills || [];
        const skillIds: string[] = [];
        const skillsToAdd: Record<string, any> = {};
        
        newSkills.forEach((sk: any) => {
          const sId = generateId('skill-npc-');
          skillIds.push(sId);
          skillsToAdd[sId] = {
            id: sId,
            ...sk
          };
        });
        
        if (Object.keys(skillsToAdd).length > 0) {
          dispatch({ type: 'ADD_SKILLS_TO_REGISTRY', payload: skillsToAdd });
        }

        const npcToJoin = {
          ...dialogue.npc,
          level: avgLevel,
          hp: 100 + avgLevel * 20,
          max_hp: 100 + avgLevel * 20,
          atk: 15 + avgLevel * 5,
          def: 10 + avgLevel * 3,
          skills: skillIds.length > 0 ? skillIds : dialogue.npc.skills,
          equipped_skills: skillIds.length > 0 ? skillIds.slice(0, 4) : dialogue.npc.equipped_skills,
          sp: 100
        };

        dispatch({ type: 'ADD_TEAM_MEMBER', payload: npcToJoin });
        dispatch({ type: 'REMOVE_ENTITY', payload: dialogue.npc.id });
        setTimeout(() => dispatch({ type: 'END_DIALOGUE' }), 2000);
      } else if (response.action === 'GIVE_ITEM') {
        setTimeout(() => {
          const itemData = response.item || { name: '神秘禮物', description: 'NPC給予的物品', icon: '🎁' };
          dispatch({ type: 'ADD_INVENTORY_ITEM', payload: { id: generateId('item-'), name: itemData.name, description: itemData.description, type: 'MATERIAL', value: 100, icon: itemData.icon } });
          dispatch({ type: 'REMOVE_ENTITY', payload: dialogue.npc.id });
          dispatch({ type: 'END_DIALOGUE' });
        }, 2000);
      } else if (response.action === 'END_DIALOGUE') {
        setTimeout(() => dispatch({ type: 'END_DIALOGUE' }), 1500);
      }
    } catch (error) {
      console.error("Dialogue error:", error);
      dispatch({ type: 'SET_DIALOGUE_LOADING', payload: false });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[100] bg-black/80 flex items-end justify-center p-6 pb-24"
    >
      <div className="w-full max-w-2xl bg-zinc-900 border-2 border-zinc-700 rounded-xl overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center gap-3 bg-zinc-800/50 px-4 py-3 border-b border-zinc-700">
          <span className="text-4xl leading-none">{dialogue.npc.avatar}</span>
          <span className="text-yellow-500 font-bold tracking-widest">{dialogue.npc.name}</span>
        </div>
        
        <div className="p-4 flex flex-col gap-4">
          <div className="flex-1 overflow-y-auto max-h-48 space-y-3 pr-2 custom-scrollbar min-h-[100px]">
            {dialogue.messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'player' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg text-sm ${m.role === 'player' ? 'bg-blue-900/40 border border-blue-500/30' : 'bg-zinc-800 border border-zinc-700'}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {dialogue.is_loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 p-3 rounded-lg text-sm animate-pulse">思考中...</div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
              placeholder="輸入對話內容..."
              className="flex-1 bg-black border border-zinc-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-yellow-500"
              disabled={dialogue.is_loading}
            />
            <button 
              onClick={() => handleSend(input)}
              disabled={dialogue.is_loading}
              className="bg-yellow-600 hover:bg-yellow-500 disabled:bg-zinc-700 disabled:text-zinc-500 px-6 py-2 rounded-lg font-bold text-sm transition-colors"
            >
              發送
            </button>
            <button 
              onClick={() => dispatch({ type: 'END_DIALOGUE' })}
              className="bg-zinc-800 hover:bg-zinc-700 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              離開
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function GameOverOverlay() {
  const { dispatch } = useContext(GameContext);
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-[200] bg-black/90 flex flex-col items-center justify-center p-6 text-center"
    >
      <motion.h2 
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-6xl font-bold text-red-600 mb-8 tracking-tighter"
      >
        GAME OVER
      </motion.h2>
      <p className="text-zinc-400 mb-12 max-w-md">
        你的隊伍已全軍覆沒。冒險雖然暫時中斷，但意志永不磨滅。
      </p>
      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => dispatch({ type: 'RESET_STAGE' })}
        className="px-8 py-4 bg-white text-black font-bold rounded-full uppercase tracking-widest hover:bg-zinc-200 transition-colors"
      >
        重置本關卡
      </motion.button>
    </motion.div>
  );
}

function CharacterDetailModal({ entity: initialEntity, onClose }: { entity: Entity; onClose: () => void }) {
  const { state, dispatch } = useContext(GameContext);
  const [isGeneratingSkills, setIsGeneratingSkills] = useState(false);
  // Find the latest entity data from state to ensure we have current XP/skills
  const entity = state.player_state.team.find(p => p.id === initialEntity.id) || 
                 state.player_state.all_characters.find(p => p.id === initialEntity.id) || 
                 initialEntity;
  
  const handleEquip = (skillId: string, slotIndex: number) => {
    if (state.game_mode === 'BATTLE') return;
    dispatch({ type: 'EQUIP_SKILL', payload: { entityId: entity.id, skillId, slotIndex } });
  };

  const handleLearn = (skill: Skill) => {
    if ((entity.sp || 0) >= (skill.sp_cost || 0)) {
      dispatch({ 
        type: 'LEARN_SKILL', 
        payload: { entityId: entity.id, skillId: skill.id, spCost: skill.sp_cost || 0 } 
      });
    }
  };

  const handleRegenerateSkills = async () => {
    setIsGeneratingSkills(true);
    try {
      const newSkills = await generateCharacterSkills(entity.name, entity.job_type, entity.level);
      if (newSkills && newSkills.length > 0) {
        const skillIds: string[] = [];
        const skillsToAdd: Record<string, Skill> = {};
        newSkills.forEach((sk: any) => {
          const sId = generateId('skill-regen-');
          skillIds.push(sId);
          skillsToAdd[sId] = {
            id: sId,
            ...sk
          };
        });
        dispatch({ type: 'ADD_SKILLS_TO_REGISTRY', payload: skillsToAdd });
        dispatch({ 
          type: 'UPDATE_CHARACTER', 
          payload: { 
            id: entity.id, 
            skills: skillIds, 
            equipped_skills: skillIds.slice(0, 4) 
          } 
        });
      }
    } catch (e) {
      console.error(e);
    }
    setIsGeneratingSkills(false);
  };

  const getAvailableJobs = (currentJob: JobType): JobType[] => {
    switch (currentJob) {
      case JobType.SWORDSMAN: return [JobType.ADV_SWORDSMAN];
      case JobType.ARCHER: return [JobType.ADV_ARCHER];
      case JobType.TANK: return [JobType.ADV_TANK];
      case JobType.HEALER: return [JobType.ADV_HEALER];
      default: return [];
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[400] bg-black/80 flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900 border border-white/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-zinc-800 p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{entity.avatar}</span>
            <div>
              <h3 className="text-xl font-bold text-yellow-500">{entity.name}</h3>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-white/40 uppercase tracking-widest">LV.{entity.level} | HP: {entity.hp} / {entity.max_hp}</p>
                <div className="w-24 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500" 
                    style={{ width: `${Math.min(100, (entity.exp || 0) / getExpToNextLevel(entity.level) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Skill Points</p>
            <p className="text-xl font-bold text-white">{entity.sp || 0} <span className="text-[10px] text-white/40">SP</span></p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {/* Unlocked Combos Section */}
          {entity.unlocked_combos && entity.unlocked_combos.length > 0 && (
            <section className="space-y-3">
              <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest border-b border-blue-500/10 pb-1">
                已解鎖組合技 / 被動
              </h4>
              <div className="grid grid-cols-1 gap-2">
                {entity.unlocked_combos.map(comboId => {
                  const combo = state.world_state.skill_combos[comboId];
                  if (!combo) return null;
                  return (
                    <div key={comboId} className="bg-blue-900/20 border border-blue-500/30 p-2 rounded-lg">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-blue-300">{combo.name}</span>
                        <span className="text-[8px] bg-blue-500/20 px-1 rounded text-blue-400 uppercase">{combo.bonus_type}</span>
                      </div>
                      <p className="text-[9px] text-white/60 leading-tight">{combo.description}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Skill Management Section */}
          <section className="space-y-3">
            <h4 className="text-[10px] font-bold text-white/60 uppercase tracking-widest border-b border-white/5 pb-1 flex justify-between">
              <span>技能管理</span>
              {state.game_mode === 'BATTLE' && <span className="text-red-500">戰鬥中不可更換</span>}
            </h4>
            
            {entity.skills.length === 0 && (
              <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl flex flex-col items-center gap-3">
                <p className="text-xs text-blue-300 text-center">這個角色目前沒有任何技能。你可以為他重新生成專屬技能！</p>
                <button
                  onClick={handleRegenerateSkills}
                  disabled={isGeneratingSkills}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-white/50 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  {isGeneratingSkills ? '技能生成中...' : '重新生成技能'}
                </button>
              </div>
            )}

            <SkillManagement 
              entity={entity}
              onLearn={handleLearn}
              onEquip={handleEquip}
            />
          </section>

          {/* Job Advancement Section */}
          {entity.level >= 15 && [JobType.SWORDSMAN, JobType.ARCHER, JobType.TANK, JobType.HEALER].includes(entity.job_type) && (
            <section className="space-y-3 p-4 bg-yellow-900/10 border border-yellow-500/20 rounded-xl">
              <h4 className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest border-b border-yellow-500/10 pb-1">
                可進行轉職！
              </h4>
              <p className="text-[10px] text-white/60 leading-tight">達到 15 級，可以選擇新的職業路徑並獲得更強大的技能組。</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {getAvailableJobs(entity.job_type).map(job => (
                  <button
                    key={job}
                    onClick={() => dispatch({ type: 'JOB_ADVANCE', payload: { entityId: entity.id, newJob: job } })}
                    className="py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-[10px] font-bold rounded-lg transition-all shadow-lg uppercase tracking-tighter"
                  >
                    轉職為 {job}
                  </button>
                ))}
              </div>
            </section>
          )}
          
          {/* Danger Zone */}
          <section className="space-y-3 pt-4 border-t border-red-900/30">
            <h4 className="text-[10px] font-bold text-red-500 uppercase tracking-widest pb-1">
              危險區域
            </h4>
            <button
              onClick={() => {
                if (window.confirm(`確定要踢除 ${entity.name} 嗎？\n此操作無法復原，角色將永久離開隊伍。`)) {
                  dispatch({ type: 'KICK_CHARACTER', payload: entity.id });
                  onClose();
                }
              }}
              className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50 hover:border-red-500/50 text-[10px] font-bold rounded-lg transition-all uppercase tracking-widest"
            >
              踢除角色
            </button>
          </section>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white/60 font-bold rounded-lg text-xs transition-all uppercase tracking-widest"
        >
          關閉
        </button>
      </motion.div>
    </motion.div>
  );
}

function MenuScreen({ initialTab = 'TEAM' }: { initialTab?: 'TEAM' | 'CHARACTERS' | 'INVENTORY' }) {
  const { state, dispatch } = useContext(GameContext);
  const [activeTab, setActiveTab] = useState<'TEAM' | 'CHARACTERS' | 'INVENTORY'>(initialTab);
  const [selectedCharacter, setSelectedCharacter] = useState<Entity | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  
  // Inventory state
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showTargetSelection, setShowTargetSelection] = useState(false);

  const allCharacters = [...(state.player_state.all_characters || [])].sort((a, b) => {
    const order: Record<string, number> = { 'MELEE': 0, 'RANGED': 1, 'MAGIC': 2, 'NONE': 3 };
    return (order[a.class_type] ?? 99) - (order[b.class_type] ?? 99);
  });
  const team = state.player_state.team || [];
  const backpack = state.player_state.backpack || [];

  const availableSlots = state.stage === 1 ? 3 : (state.stage < 4 ? 4 : (state.stage < 6 ? 5 : 6));

  const handleAddToTeam = (char: Entity) => {
    if (team.length >= availableSlots) {
      dispatch({ type: 'LOG_MESSAGE', payload: `⚠️ 隊伍已滿 (當前 Stage ${state.stage} 限制 ${availableSlots} 人)` });
      return;
    }
    if (team.some(p => p.id === char.id)) return;
    dispatch({ type: 'ADD_TEAM_MEMBER', payload: char });
  };

  const handleRemoveFromTeam = (charId: string) => {
    if (team.length <= 1) {
      dispatch({ type: 'LOG_MESSAGE', payload: `⚠️ 隊伍中至少需要有一名角色` });
      return;
    }
    dispatch({ type: 'REMOVE_TEAM_MEMBER', payload: charId });
  };

  const handleUseItem = (targetId: string) => {
    if (selectedItem) {
      dispatch({ type: 'USE_ITEM', payload: { itemId: selectedItem.id, targetId } });
      
      // Check if the item still exists in the backpack after use
      const updatedItem = state.player_state.backpack.find(i => i.id === selectedItem.id);
      if (updatedItem && (updatedItem.quantity || 1) > 1) {
        // Item still has quantity, keep selection open
        setSelectedItem({ ...updatedItem, quantity: (updatedItem.quantity || 1) - 1 });
      } else {
        setSelectedItem(null);
        setShowTargetSelection(false);
      }
    }
  };

  const handleDiscard = (itemId: string) => {
    dispatch({ type: 'DISCARD_ITEM', payload: itemId });
    setSelectedItem(null);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-zinc-900 border-b border-white/10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={state.user?.photoURL || ''} alt="" className="w-10 h-10 rounded-full border border-yellow-500/50" />
          <div>
            <p className="text-xs font-bold text-yellow-500">{state.user?.displayName}</p>
            <p className="text-[8px] text-white/40 uppercase tracking-widest">Stage {state.stage}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => dispatch({ type: 'SET_MODE', payload: 'EXPLORATION' })}
            className="text-[10px] text-yellow-500 hover:text-yellow-400 transition-colors uppercase font-bold tracking-widest border border-yellow-500/30 px-2 py-1 rounded"
          >
            返回大地圖
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10 bg-zinc-900">
        {(['TEAM', 'CHARACTERS', 'INVENTORY'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setSelectedItem(null);
              setShowTargetSelection(false);
            }}
            className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${
              activeTab === tab 
                ? 'text-yellow-500 border-b-2 border-yellow-500 bg-white/5' 
                : 'text-white/40 hover:text-white/80 hover:bg-white/5'
            }`}
          >
            {tab === 'TEAM' ? '隊伍' : tab === 'CHARACTERS' ? '角色' : '背包'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'TEAM' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">當前隊伍 ({team.length}/{availableSlots})</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-2">
              {team.map((member, index) => (
                <div 
                  key={member.id}
                  className="bg-zinc-900 border border-white/10 rounded-xl p-3 flex items-center gap-4 group hover:border-yellow-500/30 transition-all cursor-pointer"
                  onClick={() => setSelectedCharacter(member)}
                >
                  <span className="text-[10px] text-white/20 font-mono w-4">{index + 1}</span>
                  <span className="text-3xl">{member.avatar}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-bold text-white">{member.name}</span>
                      <span className="text-[8px] bg-zinc-800 px-1.5 py-0.5 rounded text-white/40 uppercase tracking-widest">{member.class_type}</span>
                    </div>
                    <div className="flex gap-3 text-[9px] text-white/60 mb-1">
                      <span>LV.{member.level}</span>
                      <span>ATK {member.atk}</span>
                      <span>DEF {member.def}</span>
                      <span className="text-blue-400">SB {member.sb}%</span>
                    </div>
                    <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mb-2">
                      <div 
                        className="h-full bg-blue-500 transition-all duration-500" 
                        style={{ width: `${Math.min(100, (member.exp || 0) / getExpToNextLevel(member.level) * 100)}%` }}
                      />
                    </div>
                    <div className="flex gap-1">
                      {member.equipped_skills.map((skillId, idx) => {
                        const skill = state.world_state.skills_registry[skillId];
                        if (!skill) return null;
                        return (
                          <div key={idx} className="bg-yellow-900/20 border border-yellow-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 group/skill relative">
                            <span className="text-[7px] font-bold text-yellow-400 uppercase tracking-tighter">{skill.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleRemoveFromTeam(member.id); }}
                    className="p-2 text-white/20 hover:text-red-500 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {Array.from({ length: availableSlots - team.length }).map((_, i) => (
                <div key={`empty-${i}`} className="h-16 border-2 border-dashed border-white/5 rounded-xl flex items-center justify-center text-white/10 text-[10px] uppercase tracking-widest">
                  空位
                </div>
              ))}
              {Array.from({ length: 6 - availableSlots }).map((_, i) => (
                <div key={`locked-${i}`} className="h-16 border-2 border-dashed border-white/5 bg-black/40 rounded-xl flex items-center justify-center text-white/10 text-[10px] uppercase tracking-widest gap-2">
                  <span>🔒</span>
                  <span>Stage {i + (availableSlots === 3 ? 2 : (availableSlots === 4 ? 4 : 6))} 解鎖</span>
                </div>
              ))}
            </div>

            {/* Characters not in team */}
            {allCharacters.filter(c => !team.some(t => t.id === c.id)).length > 0 && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3 px-1">未入隊角色</h3>
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                  {allCharacters.filter(c => !team.some(t => t.id === c.id)).map(char => (
                    <div 
                      key={char.id}
                      onClick={() => setSelectedCharacter(char)}
                      className="min-w-[60px] bg-zinc-900/50 border border-white/5 hover:border-white/30 rounded-xl p-2 flex flex-col items-center gap-1 transition-all cursor-pointer group flex-shrink-0"
                    >
                      <span className="text-2xl group-hover:scale-110 transition-transform">{char.avatar}</span>
                      <span className="text-[8px] font-bold text-white/80 truncate w-full text-center">{char.name}</span>
                      <span className="text-[7px] text-white/40">LV.{char.level}</span>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAddToTeam(char); }}
                        className="mt-1 w-full py-1 bg-white/10 hover:bg-white/20 rounded text-[8px] text-white/80 transition-colors"
                      >
                        加入
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'CHARACTERS' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">所有角色 ({allCharacters.length})</h3>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {allCharacters.map(char => {
                const inTeam = team.some(p => p.id === char.id);
                return (
                  <div 
                    key={char.id}
                    onClick={() => setSelectedCharacter(char)}
                    className={`bg-zinc-900/50 border rounded-xl p-2 flex flex-col items-center gap-1 transition-all cursor-pointer group relative ${inTeam ? 'border-yellow-500/50' : 'border-white/5 hover:border-white/30'}`}
                  >
                    {inTeam && <div className="absolute top-1 right-1 w-2 h-2 bg-yellow-500 rounded-full" />}
                    <span className="text-2xl group-hover:scale-110 transition-transform">{char.avatar}</span>
                    <span className="text-[8px] font-bold text-white/80 truncate w-full text-center">{char.name}</span>
                    <span className="text-[7px] text-white/40">LV.{char.level}</span>
                    {!inTeam && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleAddToTeam(char); }}
                        className="mt-1 w-full py-1 bg-white/10 hover:bg-white/20 rounded text-[8px] text-white/80 transition-colors"
                      >
                        加入隊伍
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'INVENTORY' && (
          <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center px-1">
              <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest">冒險背包 ({backpack.length}/20)</h3>
            </div>
            
            {backpack.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-white/20 italic text-sm">背包空空如也...</div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {backpack.map(item => (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative ${selectedItem?.id === item.id ? 'bg-yellow-900/20 border-yellow-500/50 scale-105' : 'bg-black/40 border-white/5 hover:bg-white/5'}`}
                  >
                    <span className="text-3xl">{item.icon}</span>
                    <span className="text-[8px] text-white/60 truncate w-full text-center px-1">{item.name}</span>
                    {(item.quantity || 1) > 1 && (
                      <span className="absolute top-1 right-1 bg-zinc-800 text-[8px] px-1 rounded-full border border-white/20">
                        x{item.quantity}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {selectedItem && (
              <div className="mt-auto pt-4 border-t border-white/10">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{selectedItem.icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-white">{selectedItem.name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 rounded text-white/40 uppercase">{selectedItem.type}</span>
                    </div>
                    <p className="text-[10px] text-white/60 mt-1">{selectedItem.description}</p>
                  </div>
                </div>

                {!showTargetSelection ? (
                  <div className="flex gap-2">
                    {(selectedItem.type === 'HEAL' || selectedItem.type === 'EXP_TOME') && (
                      <button 
                        onClick={() => setShowTargetSelection(true)}
                        className="flex-1 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold rounded-lg transition-colors"
                      >
                        使用物品
                      </button>
                    )}
                    <button 
                      onClick={() => handleDiscard(selectedItem.id)}
                      className="flex-1 py-2 bg-red-900/40 hover:bg-red-800/60 text-red-400 text-xs font-bold rounded-lg transition-colors border border-red-500/20"
                    >
                      丟棄物品
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] text-yellow-500 font-bold uppercase tracking-widest text-center">選擇使用對象</p>
                    <div className="grid grid-cols-4 gap-2">
                      {state.player_state.all_characters.map(member => (
                        <button
                          key={member.id}
                          onClick={() => handleUseItem(member.id)}
                          className="flex flex-col items-center p-2 bg-black/40 border border-white/10 rounded-lg hover:bg-yellow-900/20 hover:border-yellow-500/50 transition-all"
                        >
                          <span className="text-xl mb-1">{member.avatar}</span>
                          <span className="text-[8px] text-white/60 truncate w-full text-center">{member.name}</span>
                        </button>
                      ))}
                    </div>
                    <button 
                      onClick={() => setShowTargetSelection(false)}
                      className="w-full py-1 text-[10px] text-white/40 hover:text-white transition-colors"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Character Detail Modal */}
      <AnimatePresence>
        {selectedCharacter && (
          <CharacterDetailModal 
            entity={selectedCharacter} 
            onClose={() => setSelectedCharacter(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { dispatch } = useContext(GameContext);
  
  const handleFixStuck = () => {
    dispatch({ type: 'FIX_STUCK' });
    onClose();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-[150] bg-black/80 flex items-center justify-center p-6"
    >
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-white tracking-widest uppercase">遊戲設定</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white">✕</button>
        </div>
        
        <div className="space-y-4">
          <div className="p-4 bg-zinc-800/50 border border-white/5 rounded-xl">
            <h4 className="text-xs font-bold text-yellow-500 mb-2 uppercase tracking-tighter">防卡死功能</h4>
            <p className="text-[10px] text-white/40 mb-4 leading-relaxed">
              如果你的角色卡在牆壁或無法移動的地形中，點擊下方按鈕將強制回到安全座標 (1,1)。
            </p>
            <button 
              onClick={handleFixStuck}
              className="w-full py-3 bg-red-900/40 hover:bg-red-800/60 border border-red-500/30 text-red-400 font-bold rounded-lg text-xs transition-all uppercase tracking-widest"
            >
              強制回到 (1,1)
            </button>
          </div>
        </div>
        
        <button 
          onClick={onClose}
          className="w-full mt-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white/60 font-bold rounded-lg text-xs transition-all uppercase tracking-widest"
        >
          關閉
        </button>
      </div>
    </motion.div>
  );
}

function GameUI() {
  const { state, dispatch } = useContext(GameContext);
  const [isGeneratingMap, setIsGeneratingMap] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Entity | null>(null);
  const [menuTab, setMenuTab] = useState<'TEAM' | 'CHARACTERS' | 'INVENTORY'>('TEAM');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const showMenu = state.game_mode !== 'BATTLE' && state.game_mode !== 'EXPLORATION' && state.game_mode !== 'DIALOGUE';

  const handleNextStage = async (targetStage?: number | any) => {
    setIsGeneratingMap(true);
    const nextStage = typeof targetStage === 'number' ? targetStage : state.stage + 1;
    dispatch({ type: 'LOG_MESSAGE', payload: `正在生成第 ${nextStage} 層地圖...` });
    
    // Get theme from STAGE_THEMES (0-indexed)
    const themeIndex = (nextStage - 1) % STAGE_THEMES.length;
    const theme = STAGE_THEMES[themeIndex];
    
    // Randomly decide if there's an NPC (e.g., 30% chance)
    const hasVillageChief = state.player_state.all_characters.some(c => c.id.startsWith('npc-village-chief') || c.name === '村長');
    const hasNPC = (nextStage === 1 && !hasVillageChief) || (Math.random() < 0.3 && nextStage > 1);
    const enemyType = nextStage % 3 === 0 ? "精英怪物" : "普通怪物";
    
    const mapData = await generateMap(nextStage, theme, { hasNPC, enemyType });
    
    if (mapData) {
      const isBossStage = nextStage % 3 === 0;
      const monsterCount = isBossStage ? 1 : 2 + Math.floor(Math.random() * 2);
      const newMonsters: Entity[] = [];
      
      // Add monsters from AI response if available, otherwise generate random ones
      if (mapData.enemies && mapData.enemies.length > 0) {
        mapData.enemies.forEach((e: any, i: number) => {
          newMonsters.push({
            id: generateId(isBossStage ? `boss-S${nextStage}-${i}` : `monster-S${nextStage}-${i}`),
            name: e.name,
            avatar: e.avatar,
            type: 'monster',
            class_type: isBossStage ? 'MAGIC' : 'MELEE',
            job_type: JobType.MONSTER,
            x: e.x,
            y: e.y,
            hp: isBossStage ? 200 + nextStage * 20 : 30 + nextStage * 5,
            max_hp: isBossStage ? 200 + nextStage * 20 : 30 + nextStage * 5,
            atk: isBossStage ? 30 + nextStage * 5 : 15 + nextStage * 2,
            def: isBossStage ? 15 + nextStage * 2 : 5 + nextStage,
            skills: isBossStage ? ['fireball', 'bite'] : ['bite'],
            equipped_skills: isBossStage ? ['fireball', 'bite'] : ['bite'],
            exp: isBossStage ? 50 + nextStage * 10 : 10 + nextStage * 2,
            level: nextStage,
            sb: 2,
            size: isBossStage ? 2 : 1,
            sp: 0,
            shield: 0
          });
        });
      } else {
        // Fallback random monsters
        for (let i = 0; i < monsterCount; i++) {
          newMonsters.push({
            id: generateId(isBossStage ? `boss-S${nextStage}-` : `monster-S${nextStage}-`),
            name: isBossStage ? '守門巨獸' : '巡邏兵',
            avatar: isBossStage ? '🐉' : '👹',
            type: 'monster',
            class_type: isBossStage ? 'MAGIC' : 'MELEE',
            job_type: JobType.MONSTER,
            x: 5 + Math.floor(Math.random() * 4),
            y: 1 + Math.floor(Math.random() * 8),
            hp: isBossStage ? 200 + nextStage * 20 : 30 + nextStage * 5,
            max_hp: isBossStage ? 200 + nextStage * 20 : 30 + nextStage * 5,
            atk: isBossStage ? 30 + nextStage * 5 : 15 + nextStage * 2,
            def: isBossStage ? 15 + nextStage * 2 : 5 + nextStage,
            skills: isBossStage ? ['fireball', 'bite'] : ['bite'],
            equipped_skills: isBossStage ? ['fireball', 'bite'] : ['bite'],
            exp: isBossStage ? 50 + nextStage * 10 : 10 + nextStage * 2,
            level: nextStage,
            sb: 2,
            size: isBossStage ? 2 : 1,
            sp: 0,
            shield: 0
          });
        }
      }

      // Add NPCs if available
      if (mapData.npcs && mapData.npcs.length > 0) {
        mapData.npcs.forEach((npc: any) => {
          newMonsters.push({
            id: generateId(`npc-S${nextStage}-`),
            name: npc.name,
            avatar: npc.avatar,
            type: 'npc',
            class_type: 'NONE',
            job_type: JobType.MONSTER,
            x: npc.x,
            y: npc.y,
            hp: 100,
            max_hp: 100,
            atk: 10,
            def: 10,
            skills: ['bite'],
            equipped_skills: ['bite'],
            sp: 0,
            exp: 0,
            level: nextStage,
            sb: 0,
            shield: 0,
            memory: []
          });
        });
      } else if (mapData.npc) {
        // Fallback for old schema
        newMonsters.push({
          id: generateId(`npc-S${nextStage}-`),
          name: mapData.npc.name,
          avatar: mapData.npc.avatar,
          type: 'npc',
          class_type: 'NONE',
          job_type: JobType.MONSTER,
          x: mapData.npc.x,
          y: mapData.npc.y,
          hp: 100,
          max_hp: 100,
          atk: 10,
          def: 10,
          skills: ['bite'],
          equipped_skills: ['bite'],
          sp: 0,
          exp: 0,
          level: nextStage,
          sb: 0,
          shield: 0,
          memory: []
        });
      }

      // Add Bosses if available
      if (mapData.bosses && mapData.bosses.length > 0) {
        mapData.bosses.forEach((boss: any) => {
          newMonsters.push({
            id: generateId(`boss-npc-S${nextStage}-`),
            name: boss.name,
            avatar: boss.avatar,
            type: 'boss_npc',
            class_type: 'MAGIC',
            job_type: JobType.MONSTER,
            x: boss.x,
            y: boss.y,
            hp: 300 + nextStage * 30,
            max_hp: 300 + nextStage * 30,
            atk: 40 + nextStage * 8,
            def: 20 + nextStage * 5,
            skills: ['fireball', 'bite'],
            equipped_skills: ['fireball', 'bite'],
            sp: 0,
            exp: 100 + nextStage * 20,
            level: nextStage + 2,
            sb: 5,
            size: 2,
            shield: 0,
            memory: []
          });
        });
      }

      // Add Chests if available
      if (mapData.chests && mapData.chests.length > 0) {
        mapData.chests.forEach((chest: any) => {
          newMonsters.push({
            id: generateId(`chest-S${nextStage}-`),
            name: '寶箱',
            avatar: '🧰',
            type: 'chest',
            class_type: 'NONE',
            job_type: JobType.MONSTER,
            x: chest.x,
            y: chest.y,
            hp: 1,
            max_hp: 1,
            atk: 0,
            def: 0,
            skills: [],
            equipped_skills: [],
            sp: 0,
            exp: 0,
            level: 1,
            sb: 0,
            shield: 0,
            memory: []
          });
        });
      }

      // Award XP for stage completion if it's a progression
      if (typeof targetStage !== 'number') {
        const expReward = 20 + state.stage * 10;
        dispatch({ type: 'LOG_MESSAGE', payload: `🎉 成功突破第 ${state.stage} 層！全體獲得 ${expReward} EXP！` });
        state.player_state.all_characters.forEach(member => {
          dispatch({ type: 'GAIN_EXP', payload: { entityId: member.id, amount: expReward } });
        });
      }

      dispatch({ 
        type: 'SET_MAP_AND_STAGE', 
        payload: { stage: nextStage, map_data: mapData, new_monsters: newMonsters } 
      });
    } else {
      // Fallback
      if (typeof targetStage !== 'number') dispatch({ type: 'NEXT_STAGE' });
    }
    
    setIsGeneratingMap(false);
  };

  // Initial generation on login
  useEffect(() => {
    if (state.user && !isGeneratingMap && state.world_state.map_data.grid.length === 0) {
      handleNextStage(state.stage);
    }
  }, [state.user?.uid]);

  return (
    <div className="h-full w-full bg-black text-gray-100 font-pixel flex flex-col overflow-hidden touch-none">
      <FirebaseSync />
      
      {isGeneratingMap && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center gap-6"
        >
          <div className="w-16 h-16 border-4 border-yellow-600 border-t-transparent rounded-full animate-spin shadow-[0_0_20px_rgba(202,138,4,0.3)]" />
          <div className="flex flex-col items-center gap-2">
            <div className="text-yellow-500 font-bold tracking-[0.3em] animate-pulse text-xl">
              GENERATING STAGE {state.stage}...
            </div>
            <div className="text-zinc-500 text-[10px] uppercase tracking-widest text-center max-w-xs px-6 leading-relaxed">
              AI is crafting a unique dungeon for you.<br/>Please wait a moment.
            </div>
          </div>
          
          <div className="absolute bottom-12 w-48 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-yellow-600"
              animate={{ x: [-200, 200] }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}

      {showMenu ? (
        <MenuScreen initialTab={menuTab} />
      ) : (
        <>
          {/* Top: Combat Log */}
          <header className={`${state.game_mode === 'BATTLE' ? 'h-12 p-1' : 'h-28 p-2'} flex-shrink-0 bg-zinc-900/90 border-b border-zinc-800 flex flex-col transition-all duration-300`}>
            <div className={`flex justify-between items-center ${state.game_mode === 'BATTLE' ? 'mb-0' : 'mb-1'} px-1`}>
              <span className={`${state.game_mode === 'BATTLE' ? 'text-[8px] leading-none' : 'text-[10px]'} text-yellow-500 uppercase tracking-widest font-bold transition-all`}>Combat Log</span>
              <div className="flex items-center gap-3">
                <span className={`${state.game_mode === 'BATTLE' ? 'text-[8px] leading-none' : 'text-[10px]'} text-white/40 font-mono transition-all`}>STAGE {state.stage}</span>
                {state.game_mode !== 'BATTLE' && (
                  <button 
                    onClick={() => dispatch({ type: 'SET_MODE', payload: 'MENU' })}
                    className="text-[10px] text-blue-400 font-bold hover:text-blue-300 transition-colors"
                  >
                    返回主選單
                  </button>
                )}
              </div>
            </div>
            <div className={`flex-1 overflow-y-auto ${state.game_mode === 'BATTLE' ? 'text-[8px] leading-tight space-y-0' : 'text-[11px] space-y-1'} font-mono px-1 touch-auto no-scrollbar transition-all`}>
              {state.combat_log.length === 0 && <p className="text-zinc-600 italic">Waiting for action...</p>}
              <AnimatePresence>
                {Array.from(new Map<string, { id: string; text: string }>(state.combat_log.map(log => [log.id, log])).values()).map((log) => (
                  <motion.p 
                    key={log.id}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={log.text.includes('💥') || log.text.includes('連鎖') ? 'text-yellow-400 font-bold' : 'text-zinc-400'}
                  >
                    {`> ${log.text}`}
                  </motion.p>
                ))}
              </AnimatePresence>
            </div>
          </header>

          {/* Middle: BattleGrid */}
          <main className="flex-1 flex items-center justify-center relative overflow-hidden bg-[#0a0a0a]">
            <BattleGrid />
            <LevelUpOverlay />
            
            <AnimatePresence>
              {state.game_mode === 'DIALOGUE' && <DialogueOverlay />}
              {state.is_game_over && <GameOverOverlay />}
              {selectedMember && (
                <CharacterDetailModal 
                  entity={selectedMember} 
                  onClose={() => setSelectedMember(null)} 
                />
              )}
              {isSettingsOpen && (
                <SettingsModal 
                  onClose={() => setIsSettingsOpen(false)} 
                />
              )}
            </AnimatePresence>

            {/* Floating Next Stage Button */}
            {state.game_mode === 'EXPLORATION' && state.world_state.entities_on_map.filter(e => e.type === 'monster' || (e.type === 'boss_npc' && e.hp > 0)).length === 0 && (
              <motion.button 
                initial={{ scale: 0.8, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                whileTap={{ scale: 0.9 }}
                disabled={isGeneratingMap}
                onClick={handleNextStage}
                className={`absolute bottom-6 right-6 px-6 py-3 bg-yellow-600 text-white font-bold rounded-full shadow-[0_0_20px_rgba(202,138,4,0.4)] border border-yellow-400/50 z-50 uppercase text-xs tracking-widest ${isGeneratingMap ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isGeneratingMap ? 'Generating...' : 'Next Stage ➔'}
              </motion.button>
            )}
          </main>

          {/* Bottom: Horizontal Navigation */}
          {state.game_mode !== 'BATTLE' && (
            <footer className="h-20 flex-shrink-0 bg-zinc-900 border-t border-zinc-800 flex items-center justify-around px-4 gap-3">
              <button 
                onClick={() => {
                  setMenuTab('TEAM');
                  dispatch({ type: 'SET_MODE', payload: 'MENU' });
                }}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-12 h-12 bg-zinc-800 group-hover:bg-zinc-700 rounded-xl border border-white/5 flex items-center justify-center text-xl transition-all shadow-lg">
                  ⚔️
                </div>
                <span className="text-[10px] font-bold text-white/60 group-hover:text-yellow-500 uppercase tracking-tighter">隊伍</span>
              </button>

              <button 
                onClick={() => {
                  setMenuTab('CHARACTERS');
                  dispatch({ type: 'SET_MODE', payload: 'MENU' });
                }}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-12 h-12 bg-zinc-800 group-hover:bg-zinc-700 rounded-xl border border-white/5 flex items-center justify-center text-xl transition-all shadow-lg">
                  👤
                </div>
                <span className="text-[10px] font-bold text-white/60 group-hover:text-yellow-500 uppercase tracking-tighter">角色</span>
              </button>

              <button 
                onClick={() => {
                  setMenuTab('INVENTORY');
                  dispatch({ type: 'SET_MODE', payload: 'MENU' });
                }}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-12 h-12 bg-zinc-800 group-hover:bg-zinc-700 rounded-xl border border-white/5 flex items-center justify-center text-xl transition-all shadow-lg">
                  🎒
                </div>
                <span className="text-[10px] font-bold text-white/60 group-hover:text-yellow-500 uppercase tracking-tighter">背包</span>
              </button>

              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex flex-col items-center gap-1 group"
              >
                <div className="w-12 h-12 bg-zinc-800 group-hover:bg-zinc-700 rounded-xl border border-white/5 flex items-center justify-center text-xl transition-all shadow-lg">
                  ⚙️
                </div>
                <span className="text-[10px] font-bold text-white/60 group-hover:text-yellow-500 uppercase tracking-tighter">設定</span>
              </button>
            </footer>
          )}
        </>
      )}
    </div>
  );
}

export default function App() {
  return (
    <GameProvider>
      <GameUI />
    </GameProvider>
  );
}
