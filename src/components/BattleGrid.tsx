import React, { useContext, useEffect, useRef, useState, useMemo } from 'react';
import { GameContext, TerrainType, Entity, GameMode, generateId, Skill, calculateTriggerRate } from '../context/GameContext';
import { aStar, Point } from '../lib/pathfinding';
import { TEXTURES, isSolidObject } from '../constants/textures';
import { motion, AnimatePresence } from 'motion/react';
import { getNPCDialogueResponse } from '../services/geminiService';

const TERRAIN_COLORS: Record<TerrainType, string> = {
  0: 'bg-[#2d3a2d]', // Grass (0) - Muted forest green
  1: 'bg-[#121212]', // Wall/Mountain (1) - Dark charcoal
  2: 'bg-[#4a3728]', // House/Building (2) - Warm brown
  3: 'bg-[#3b1e54]', // Stairs Down (3) - Deep violet
  4: 'bg-[#3d4f3d]'  // High Ground (4) - Lighter moss green
};

const SkillAnimationOverlay = ({ state, tileSize, gridGap }: { state: any, tileSize: number, gridGap: number }) => {
  const anim = state.active_skill_animation;
  const skill = anim ? state.world_state.skills_registry[anim.skill_id] : null;
  const attacker = anim ? [...state.player_state.team, ...state.world_state.entities_on_map, ...state.battle_monsters].find(e => e.id === anim.attacker_id) : null;
  const attackerCenterOffset = attacker ? ((attacker.size || 1) * tileSize) / 2 : 0;

  return (
    <AnimatePresence>
      {anim && skill && attacker && (
        <div key={`${anim.attacker_id}-${anim.skill_id}`}>
          {/* Skill Name Tooltip */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: -tileSize - 10 }}
            exit={{ opacity: 0, scale: 0.8, y: -tileSize - 30 }}
            style={{ 
              position: 'absolute',
              top: `${attacker.y * (tileSize + gridGap) + 10}px`, 
              left: `${attacker.x * (tileSize + gridGap) + 10 + attackerCenterOffset}px`,
              transform: 'translateX(-50%)',
              zIndex: 200
            }}
            className="pointer-events-none min-w-[140px]"
          >
            <div className="bg-black/95 border-2 border-white p-2 rounded shadow-[0_0_20px_rgba(0,0,0,0.5)] font-mono text-center relative">
              <h3 className="text-yellow-400 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap">{skill.name}</h3>
              <div className="h-[1px] bg-white/20 my-1" />
              <p className="text-white text-[9px] leading-tight italic line-clamp-2">"{skill.description}"</p>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white" />
            </div>
          </motion.div>

      {/* Fire Wave for fire_slash variants */}
      {anim.skill_id.startsWith('fire_slash') && (
        <motion.div
          initial={{ 
            x: attacker.x * (tileSize + gridGap) + attackerCenterOffset + 10,
            y: attacker.y * (tileSize + gridGap) + attackerCenterOffset + 10,
            scale: 0,
            opacity: 0
          }}
          animate={{ 
            scale: [0, 10],
            opacity: [0, 0.8, 0]
          }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
          className="absolute z-[140] pointer-events-none"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/40 via-orange-500/20 to-transparent blur-2xl border-4 border-red-500/30" />
        </motion.div>
      )}

      {/* Projectile / Attack Animation from Attacker to Targets */}
      {anim.affected_tiles.length > 0 && (
        <motion.div
          initial={{ 
            x: attacker.x * (tileSize + gridGap) + attackerCenterOffset + 10,
            y: attacker.y * (tileSize + gridGap) + attackerCenterOffset + 10,
            opacity: 0,
            scale: 0.5
          }}
          animate={{ 
            x: anim.affected_tiles[0].x * (tileSize + gridGap) + tileSize / 2 + 10,
            y: anim.affected_tiles[0].y * (tileSize + gridGap) + tileSize / 2 + 10,
            opacity: [0, 1, 1, 0],
            scale: [0.5, 1.5, 1.5, 0.5]
          }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
          className="absolute z-[180] pointer-events-none"
        >
          {anim.skill_id === 'bite' && (
            <div className="relative w-12 h-12 flex items-center justify-center">
              <motion.div 
                animate={{ scale: [1, 2], opacity: [1, 0] }}
                className="absolute inset-0 bg-red-600/40 rounded-full blur-xl"
              />
              <span className="text-4xl filter drop-shadow-[0_0_10px_red]">🦷</span>
              {/* Blood Splatter */}
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0], 
                    scale: [0, 1.5, 0.5],
                    x: [0, (Math.random() - 0.5) * 100],
                    y: [0, (Math.random() - 0.5) * 100]
                  }}
                  transition={{ duration: 0.4, delay: 0.08 + i * 0.016 }}
                  className="absolute w-2 h-2 bg-red-700 rounded-full blur-[1px]"
                />
              ))}
            </div>
          )}
          {anim.skill_id === 'thunder_strike' && (
            <div className="relative w-12 h-[500%] flex items-center justify-center origin-top">
              <motion.div 
                animate={{ opacity: [0, 1, 0, 1, 0] }}
                className="w-2 h-full bg-cyan-300 shadow-[0_0_30px_cyan]"
              />
              <motion.div 
                animate={{ opacity: [0, 0.5, 0], scale: [1, 2, 1] }}
                className="absolute w-10 h-full bg-white/20 blur-xl"
              />
              {/* Lightning Sparks */}
              {[...Array(10)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: [0, 1, 0], 
                    scale: [0, 1.5, 0],
                    x: [(Math.random() - 0.5) * 100, (Math.random() - 0.5) * 200],
                    y: [Math.random() * 100, Math.random() * 200]
                  }}
                  transition={{ duration: 0.32, delay: Math.random() * 0.16 }}
                  className="absolute w-1 h-1 bg-cyan-200 rounded-full blur-[1px]"
                />
              ))}
            </div>
          )}
          {!['bite', 'thunder_strike'].includes(anim.skill_id) && (
            <div className="w-10 h-1 bg-white shadow-[0_0_15px_white] rotate-45 blur-[1px]" />
          )}
        </motion.div>
      )}

      {/* Grid Highlights Flash */}
      <div className="absolute inset-0 pointer-events-none z-[150]">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.2, 0] }}
          transition={{ duration: 0.25, delay: 0.2 }}
          className="w-full h-full bg-white"
        />
      </div>
        </div>
      )}
    </AnimatePresence>
  );
};

const DamageNumberDisplay = ({ state, dispatch, tileSize, gridGap }: { state: any, dispatch: any, tileSize: number, gridGap: number }) => {
  const { damage_numbers } = state;
  return (
    <div className="absolute inset-0 pointer-events-none z-[500]">
      <AnimatePresence>
        {damage_numbers.map((dmg: any) => (
          <motion.div
            key={dmg.id}
            initial={{ opacity: 0, y: 0, scale: 0.5 }}
            animate={{ opacity: 1, y: -tileSize, scale: 1.2 }}
            exit={{ opacity: 0, scale: 1.5 }}
            onAnimationComplete={() => {
              dispatch({ type: 'CLEAR_DAMAGE_NUMBER', payload: dmg.id });
            }}
            className={`absolute font-pixel font-bold text-lg drop-shadow-[0_2px_0_rgba(0,0,0,0.8)] z-[500]`}
            style={{
              top: dmg.y * (tileSize + gridGap) + tileSize / 4 + 10,
              left: dmg.x * (tileSize + gridGap) + tileSize / 2 + 10,
              transform: 'translateX(-50%)',
              color: dmg.type === 'damage' ? '#ff4444' : '#4ade80'
            }}
          >
            {dmg.type === 'heal' ? `+${dmg.amount}` : dmg.amount}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

const StatusEffectsDisplay = ({ entity }: { entity: Entity }) => {
  if (!entity.status_effects || entity.status_effects.length === 0) return null;

  return (
    <>
      {/* Status Effect VFX Overlays */}
      <div className="absolute inset-0 pointer-events-none z-30">
        {entity.status_effects.some(se => se.effect_type === 'burn') && (
          <motion.div 
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="absolute inset-0 bg-red-500/20 rounded-sm blur-sm"
          />
        )}
        {entity.status_effects.some(se => se.effect_type === 'regen') && (
          <motion.div 
            animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 bg-green-400/20 rounded-sm blur-md"
          />
        )}
        {entity.status_effects.some(se => se.effect_type === 'stun') && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-lg animate-bounce">💫</div>
        )}
      </div>

      <div className="absolute -top-6 left-0 right-0 flex justify-center gap-1 pointer-events-none z-[100]">
      <AnimatePresence>
        {entity.status_effects.map((effect) => (
          <motion.div
            key={effect.id}
            initial={{ opacity: 0, y: 5, scale: 0.5 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            className={`relative group`}
          >
            <div className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] border shadow-sm ${
              effect.type === 'buff' ? 'bg-blue-900/80 border-blue-400' : 'bg-red-900/80 border-red-400'
            }`}>
              {effect.icon}
              
              {/* Duration Badge */}
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-black rounded-full border border-white/20 flex items-center justify-center text-[7px] font-bold text-white">
                {effect.duration}
              </div>
            </div>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-black/90 border border-white/20 px-1.5 py-0.5 rounded whitespace-nowrap z-[200]">
              <p className="text-[8px] font-bold text-white uppercase tracking-tighter">{effect.name}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  </>
);
};

const MonsterInfoOverlay = ({ state, selectedEntityId, tileSize, gridGap, currentWidth }: { state: any, selectedEntityId: string | null, tileSize: number, gridGap: number, currentWidth: number }) => {
  if (!selectedEntityId) return null;
  const { battle_monsters } = state;
  const { entities_on_map, skills_registry } = state.world_state;
  const monster = [...battle_monsters, ...entities_on_map].find(m => m.id === selectedEntityId);
  if (!monster) return null;

  const skill = monster.skills && monster.skills.length > 0 ? skills_registry[monster.skills[0]] : null;
  const size = monster.size || 1;
  const isOnRight = monster.x > currentWidth / 2;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, x: isOnRight ? 20 : -20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      className="absolute z-[250] bg-zinc-900/95 border border-white/20 p-3 rounded-lg shadow-2xl pointer-events-none min-w-[160px]"
      style={{
        top: monster.y * (tileSize + gridGap) + 10,
        left: isOnRight 
          ? (monster.x * (tileSize + gridGap)) - 160 
          : (monster.x + size) * (tileSize + gridGap) + 20,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{monster.avatar}</span>
        <div>
          <h4 className="text-yellow-400 font-bold text-sm">{monster.name}</h4>
          <p className="text-[10px] text-white/60">ID: {monster.id}</p>
          <p className="text-[10px] text-white/60">HP: {monster.hp}/{monster.max_hp}</p>
        </div>
      </div>
      <div className="h-[1px] bg-white/10 my-2" />
      {skill && (
        <div>
          <p className="text-yellow-500/80 text-[10px] font-bold uppercase tracking-wider mb-1">技能: {skill.name}</p>
          <p className="text-white/80 text-[10px] leading-tight italic">{skill.description}</p>
        </div>
      )}
    </motion.div>
  );
};

export default function BattleGrid() {
  const { state, dispatch } = useContext(GameContext);
  const { game_mode, current_path, battle_monsters } = state;
  const { map_data, skills_registry } = state.world_state;
  
  const entities_on_map = useMemo(() => {
    const base = state.world_state.entities_on_map;
    if (game_mode === 'BATTLE' && state.active_battle_id) {
      return base.filter(e => e.id !== state.active_battle_id);
    }
    return base;
  }, [state.world_state.entities_on_map, game_mode, state.active_battle_id]);

  const { team } = state.player_state;

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number, y: number } | null>(null);
  const [lastSwappedId, setLastSwappedId] = useState<string | null>(null);
  const [pincerHighlights, setPincerHighlights] = useState<Point[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const isMovingRef = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef<{ x: number, y: number } | null>(null);
  const lastProcessedTile = useRef<{ x: number, y: number } | null>(null);

  // Battle Grid Constants
  const BATTLE_GRID_WIDTH = 6;
  const BATTLE_GRID_HEIGHT = 8;
  
  // Use a ref to always have the latest state in event listeners
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Responsive tile size calculation
  const [tileSize, setTileSize] = useState(32);
  const gridGap = 1;

  useEffect(() => {
    const updateSize = () => {
      // Calculate based on available width and height
      const availableWidth = window.innerWidth - 32;
      const headerHeight = game_mode === 'BATTLE' ? 48 : 112; // h-12 (48px) or h-28 (112px)
      const footerHeight = game_mode === 'BATTLE' ? 0 : 80;   // h-20 (80px) or hidden
      const availableHeight = window.innerHeight - headerHeight - footerHeight - 32; // 32 for padding
      
      const width = game_mode === 'BATTLE' ? BATTLE_GRID_WIDTH : map_data.width;
      const height = game_mode === 'BATTLE' ? BATTLE_GRID_HEIGHT : map_data.height;

      const sizeByWidth = Math.floor((availableWidth - (width - 1) * gridGap) / width);
      const sizeByHeight = Math.floor((availableHeight - (height - 1) * gridGap) / height);
      
      // For battle mode, we want to ensure it fits both ways and allow larger tiles
      const finalSize = game_mode === 'BATTLE' 
        ? Math.min(sizeByWidth, sizeByHeight, 100)
        : Math.min(sizeByWidth, sizeByHeight, 64);

      setTileSize(Math.max(finalSize, 20));
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [map_data.width, map_data.height, game_mode]);

  useEffect(() => {
    if (state.active_skill_animation) {
      const skillId = state.active_skill_animation.skill_id;
      const skill = state.world_state.skills_registry[skillId];
      if (['earthquake', 'boss_smash', 'fire_nova', 'thunder_strike', 'arrow_rain_1', 'arrow_rain_2'].includes(skillId)) {
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    }
  }, [state.active_skill_animation]);

  const calculateFinalDamage = (attacker: Entity, baseDamage: number, skillId: string) => {
    let multiplier = 1;
    if (attacker.unlocked_combos) {
      attacker.unlocked_combos.forEach(comboId => {
        const combo = state.world_state.skill_combos[comboId];
        if (combo && combo.bonus_type === 'PASSIVE') {
          if (comboId === 'elemental_synergy') {
            multiplier += combo.bonus_value || 0;
          } else if (comboId === 'holy_fire') {
            const skill = state.world_state.skills_registry[skillId];
            if (skill && (skill.effect === 'burn' || skill.damage < 0)) {
              multiplier += combo.bonus_value || 0;
            }
          } else if (comboId === 'storm_lord' && skillId === 'thunder_strike') {
            multiplier += combo.bonus_value || 0;
          }
        }
      });
    }
    return Math.round(baseDamage * multiplier);
  };

  // --- Terra Battle Drag Logic ---
  const isPathValid = (start: Point, end: Point) => {
    if (start.x === end.x && start.y === end.y) return true;

    const isTurn = start.x !== end.x && start.y !== end.y;

    const checkCell = (x: number, y: number) => {
      if (x < 0 || x >= currentWidth || y < 0 || y >= currentHeight) return false;
      
      // Check for solid objects
      if (game_mode === 'EXPLORATION') {
        const objectId = map_data.objectGrid?.[y]?.[x];
        if (objectId && isSolidObject(objectId)) return false;
      }

      // Check for enemies
      const monstersToCheck = game_mode === 'BATTLE' ? battle_monsters : entities_on_map;
      const monsterAt = monstersToCheck.find(m => {
        if (m.hp <= 0 || m.type !== 'monster') return false;
        const mSize = m.size || 1;
        return x >= m.x && x < m.x + mSize && y >= m.y && y < m.y + mSize;
      });
      if (monsterAt) return false;

      return true;
    };

    // L-path check (Max 1 turn)
    // Path 1: Horizontal then Vertical. Turn point is (end.x, start.y)
    let path1Valid = true;
    const turnPoint1 = { x: end.x, y: start.y };
    const distToTurn1 = Math.abs(turnPoint1.x - start.x) + Math.abs(turnPoint1.y - start.y);
    
    // Requirement: Turn point must be adjacent to start if it's a turn
    if (isTurn && distToTurn1 > 1) {
      path1Valid = false;
    } else {
      const xDir = end.x > start.x ? 1 : -1;
      const yDir = end.y > start.y ? 1 : -1;
      // Check horizontal segment
      for (let x = start.x + (start.x === end.x ? 0 : xDir); x !== end.x + (start.x === end.x ? 0 : xDir); x += xDir) {
        if (!checkCell(x, start.y)) { path1Valid = false; break; }
      }
      // Check vertical segment
      if (path1Valid) {
        for (let y = start.y + (start.y === end.y ? 0 : yDir); y !== end.y + (start.y === end.y ? 0 : yDir); y += yDir) {
          if (!checkCell(end.x, y)) { path1Valid = false; break; }
        }
      }
    }

    // Path 2: Vertical then Horizontal. Turn point is (start.x, end.y)
    let path2Valid = true;
    const turnPoint2 = { x: start.x, y: end.y };
    const distToTurn2 = Math.abs(turnPoint2.x - start.x) + Math.abs(turnPoint2.y - start.y);

    if (isTurn && distToTurn2 > 1) {
      path2Valid = false;
    } else {
      const xDir = end.x > start.x ? 1 : -1;
      const yDir = end.y > start.y ? 1 : -1;
      // Check vertical segment
      for (let y = start.y + (start.y === end.y ? 0 : yDir); y !== end.y + (start.y === end.y ? 0 : yDir); y += yDir) {
        if (!checkCell(start.x, y)) { path2Valid = false; break; }
      }
      // Check horizontal segment
      if (path2Valid) {
        for (let x = start.x + (start.x === end.x ? 0 : xDir); x !== end.x + (start.x === end.x ? 0 : xDir); x += xDir) {
          if (!checkCell(x, end.y)) { path2Valid = false; break; }
        }
      }
    }

    return path1Valid || path2Valid;
  };

  const handleMouseDown = (e: React.MouseEvent, entity: Entity) => {
    if (game_mode !== 'BATTLE' || entity.type !== 'player' || state.active_skill_animation) return;
    // Check for stun
    if (entity.status_effects?.some(se => se.effect_type === 'stun')) {
      dispatch({ type: 'LOG_MESSAGE', payload: `⚠️ ${entity.name} 處於眩暈狀態，無法行動！` });
      return;
    }
    setDraggingId(entity.id);
    setDragPos({ x: e.clientX, y: e.clientY });
    dragStartPos.current = { x: entity.x, y: entity.y };
    lastProcessedTile.current = { x: entity.x, y: entity.y };
  };

  const handleTouchStart = (e: React.TouchEvent, entity: Entity) => {
    if (game_mode !== 'BATTLE' || entity.type !== 'player' || state.active_skill_animation) return;
    // Check for stun
    if (entity.status_effects?.some(se => se.effect_type === 'stun')) {
      dispatch({ type: 'LOG_MESSAGE', payload: `⚠️ ${entity.name} 處於眩暈狀態，無法行動！` });
      return;
    }
    setDraggingId(entity.id);
    const touch = e.touches[0];
    setDragPos({ x: touch.clientX, y: touch.clientY });
    dragStartPos.current = { x: entity.x, y: entity.y };
    lastProcessedTile.current = { x: entity.x, y: entity.y };
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!draggingId || game_mode !== 'BATTLE' || !gridRef.current) return;
    // Prevent scrolling while dragging
    if (e.cancelable) e.preventDefault();
    const touch = e.touches[0];
    processMove(touch.clientX, touch.clientY);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingId || game_mode !== 'BATTLE' || !gridRef.current) return;
    processMove(e.clientX, e.clientY);
  };

  const processMove = (clientX: number, clientY: number) => {
    if (!gridRef.current || state.active_skill_animation) return;
    setDragPos({ x: clientX, y: clientY });

    const rect = gridRef.current.getBoundingClientRect();
    // Border is 6px, Padding is 4px (p-1)
    const relX = clientX - rect.left - 10;
    const relY = clientY - rect.top - 10;

    const x = Math.floor(relX / (tileSize + gridGap));
    const y = Math.floor(relY / (tileSize + gridGap));

    if (x >= 0 && x < currentWidth && y >= 0 && y < currentHeight) {
      const draggedEntity = stateRef.current.player_state.team.find(p => p.id === draggingId);
      if (draggedEntity) {
        // Only move if the path is valid (L-path, max 1 turn)
        if (isPathValid({ x: draggedEntity.x, y: draggedEntity.y }, { x, y })) {
          handleMouseEnter(x, y);
        }
      }
    }
  };

  const handleMouseEnter = (x: number, y: number) => {
    if (!draggingId || game_mode !== 'BATTLE') return;

    const draggedEntity = stateRef.current.player_state.team.find(p => p.id === draggingId);
    if (!draggedEntity) return;

    // Prevent redundant dispatches if still on the same tile
    if (draggedEntity.x === x && draggedEntity.y === y) return;
    if (lastProcessedTile.current?.x === x && lastProcessedTile.current?.y === y) return;

    // Object collision check
    if (game_mode === 'EXPLORATION') {
      const objectId = map_data.objectGrid ? map_data.objectGrid[y][x] : null;
      if (objectId && isSolidObject(objectId)) return;
    }

    // Monster check: If target tile is a monster, character "sticks" to its current position
    const monstersToCheck = game_mode === 'BATTLE' ? battle_monsters : entities_on_map;
    const monsterAt = monstersToCheck.find(m => {
      if (m.hp <= 0) return false;
      const mSize = m.size || 1;
      return x >= m.x && x < m.x + mSize && y >= m.y && y < m.y + mSize;
    });
    if (monsterAt) return;

    lastProcessedTile.current = { x, y };

    // Ally Swap logic (Push)
    const allyAt = stateRef.current.player_state.team.find(p => p.x === x && p.y === y && p.id !== draggingId);
    if (allyAt) {
      setLastSwappedId(allyAt.id);
      setTimeout(() => setLastSwappedId(null), 300);
      dispatch({ 
        type: 'SWAP_ENTITIES', 
        payload: { 
          activeId: draggingId, 
          targetId: allyAt.id, 
          activeX: x, 
          activeY: y, 
          targetX: draggedEntity.x, 
          targetY: draggedEntity.y 
        } 
      });
    } else {
      // Normal move
      dispatch({ 
        type: 'MOVE_ENTITY', 
        payload: { id: draggingId, x, y } 
      });
    }
  };

  const handleMouseUp = () => {
    if (draggingId) {
      // Use stateRef to get the absolute latest positions
      const latestTeam = stateRef.current.player_state.team;
      const draggedEntity = latestTeam.find(p => p.id === draggingId);
      
      const moved = draggedEntity && dragStartPos.current && (
        draggedEntity.x !== dragStartPos.current.x || 
        draggedEntity.y !== dragStartPos.current.y
      );
      
      const currentDraggingId = draggingId;
      setDraggingId(null);
      setDragPos(null);
      
      if (moved) {
        console.log("Move detected, checking pincers for:", currentDraggingId);
        // Add a small delay to ensure stateRef has the latest state after the last MOVE_ENTITY dispatch
        setTimeout(() => checkPincers(currentDraggingId), 50);
      } else {
        console.log("No move detected, turn not ended.");
      }
      dragStartPos.current = null;
    }
  };

  useEffect(() => {
    const options = { passive: false };
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, options);
    
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [draggingId]);

  const moveIdRef = useRef(0);
  useEffect(() => {
    if (game_mode === 'EXPLORATION' && current_path.length > 0 && !isMovingRef.current) {
      isMovingRef.current = true;
      const currentMoveId = ++moveIdRef.current;
      
      const moveStep = async () => {
        const path = [...current_path];
        const hero = team[0];
        
        while (path.length > 0) {
          // Check if this move has been cancelled by a newer one or if a skill is animating
          if (currentMoveId !== moveIdRef.current || stateRef.current.game_mode !== 'EXPLORATION' || stateRef.current.active_skill_animation) {
            break;
          }

          const nextStep = path.shift();
          if (nextStep) {
            const npcNearby = stateRef.current.world_state.entities_on_map.find(n => 
              (n.type === 'npc' || n.type === 'boss_npc') && 
              Math.abs(n.x - nextStep.x) <= 1 && 
              Math.abs(n.y - nextStep.y) <= 1 &&
              n.id !== stateRef.current.last_dialogue_npc_id
            );
            if (npcNearby) {
              dispatch({ type: 'START_DIALOGUE', payload: npcNearby });
              dispatch({ type: 'SET_PATH', payload: [] });
              break;
            }

            if (stateRef.current.last_dialogue_npc_id) {
              const lastNpc = stateRef.current.world_state.entities_on_map.find(n => n.id === stateRef.current.last_dialogue_npc_id);
              if (lastNpc) {
                const dist = Math.abs(lastNpc.x - nextStep.x) + Math.abs(lastNpc.y - nextStep.y);
                if (dist > 1) {
                  dispatch({ type: 'RESET_LAST_NPC' });
                }
              }
            }

            const monsterNearby = stateRef.current.world_state.entities_on_map.find(m => 
              m.type === 'monster' && Math.abs(m.x - nextStep.x) <= 1 && Math.abs(m.y - nextStep.y) <= 1
            );
            if (monsterNearby) {
              dispatch({ type: 'TRIGGER_BATTLE', payload: { encounterId: monsterNearby.id } });
              dispatch({ type: 'SET_PATH', payload: [] });
              break;
            }

            dispatch({ type: 'MOVE_ENTITY', payload: { id: hero.id, x: nextStep.x, y: nextStep.y } });
            // We don't need to dispatch SET_PATH here, it just causes unnecessary re-renders
            // dispatch({ type: 'SET_PATH', payload: [...path] }); 
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        }
        
        if (currentMoveId === moveIdRef.current) {
          isMovingRef.current = false;
          dispatch({ type: 'SET_PATH', payload: [] });
        }
      };
      moveStep();
    }
  }, [current_path.length, game_mode]);

  const handleTileClick = (e: React.MouseEvent, x: number, y: number) => {
    e.stopPropagation();
    if (state.active_skill_animation) return;
    if (game_mode === 'BATTLE') {
      const monster = battle_monsters.find(m => {
        const size = m.size || 1;
        return x >= m.x && x < m.x + size && y >= m.y && y < m.y + size;
      });
      if (monster) {
        setSelectedEntityId(monster.id);
      } else {
        setSelectedEntityId(null);
      }
      return;
    }
    if (game_mode !== 'EXPLORATION') return;
    
    // Check if clicking directly on an NPC or Boss or Chest
    const npcAt = entities_on_map.find(n => (n.type === 'npc' || n.type === 'boss_npc' || n.type === 'chest') && n.x === x && n.y === y);
    
    // Get all solid objects as obstacles for aStar
    const objectObstacles: Point[] = [];
    if (game_mode === 'EXPLORATION' && map_data.objectGrid) {
      for (let oy = 0; oy < map_data.height; oy++) {
        for (let ox = 0; ox < map_data.width; ox++) {
          const id = map_data.objectGrid[oy][ox];
          if (id && isSolidObject(id)) {
            objectObstacles.push({ x: ox, y: oy });
          }
        }
      }
    }

    if (npcAt) {
      const hero = team[0];
      const dist = Math.abs(hero.x - x) + Math.abs(hero.y - y);
      if (dist <= 1) {
        if (npcAt.type === 'chest') {
          dispatch({ type: 'OPEN_CHEST', payload: npcAt.id });
        } else if (state.game_mode !== 'DIALOGUE' || state.active_dialogue?.npc.id !== npcAt.id) {
          dispatch({ type: 'START_DIALOGUE', payload: npcAt });
        }
      } else {
        // Move towards NPC or Chest
        const path = aStar({ x: hero.x, y: hero.y }, { x, y }, currentGrid, currentWidth, currentHeight, objectObstacles);
        if (path.length > 1) {
          path.shift(); // Remove current pos
          // We don't want to step ON the NPC/Chest, just next to it
          path.pop(); 
          dispatch({ type: 'SET_PATH', payload: path });
        }
      }
      return;
    }

    const monsterAt = entities_on_map.find(m => {
      if (m.hp <= 0) return false;
      const mSize = m.size || 1;
      return x >= m.x && x < m.x + mSize && y >= m.y && y < m.y + mSize;
    });
    if (monsterAt) return;
    const hero = team[0];
    const path = aStar({ x: hero.x, y: hero.y }, { x, y }, currentGrid, currentWidth, currentHeight, objectObstacles);
    if (path.length > 0) {
      path.shift();
      dispatch({ type: 'SET_PATH', payload: path });
    }
  };



  const checkPincers = async (movingCharId: string | null) => {
    console.log("checkPincers called with movingCharId:", movingCharId);
    // Use latest state from Ref to avoid closure issues
    const { world_state, player_state, game_mode: currentMode, battle_monsters: currentBattleMonsters } = stateRef.current;
    const monsters = (currentMode === 'BATTLE' ? currentBattleMonsters.filter(m => m.hp > 0) : world_state.entities_on_map.filter(m => m.hp > 0 && m.type === 'monster'));
    const players = player_state.team.filter(p => p.hp > 0);
    const skills = world_state.skills_registry;
    const map_data = world_state.map_data;
    
    console.log("Players in battle:", players.length, "Monsters in battle:", monsters.length);
    
    let anyPincerTriggered = false;

    const getEntityAt = (x: number, y: number) => {
      const p = players.find(p => p.x === x && p.y === y);
      if (p) return { type: 'player', entity: p };
      const m = monsters.find(m => {
        const size = m.size || 1;
        return x >= m.x && x < m.x + size && y >= m.y && y < m.y + size;
      });
      if (m) return { type: 'monster', entity: m };
      return null;
    };

    const getChain = (startAllies: Entity[]) => {
      const chain = new Set<string>(startAllies.map(a => a.id));
      const queue = [...startAllies];
      while (queue.length > 0) {
        const current = queue.shift()!;
        // Cross range chain: same X or same Y
        const neighbors = players.filter(p => 
          !chain.has(p.id) && 
          (p.x === current.x || p.y === current.y)
        );
        for (const n of neighbors) {
          chain.add(n.id);
          queue.push(n);
        }
      }
      return Array.from(chain).map(id => players.find(p => p.id === id)!);
    };

    const pincerGroups: { allies: Entity[], monsters: Entity[], targetTiles: Point[] }[] = [];

    // --- Corner Pincer Detection ---
    const visitedMonsters = new Set<string>();
    const monsterGroups: Entity[][] = [];

    monsters.forEach(m => {
      if (visitedMonsters.has(m.id)) return;
      
      const group: Entity[] = [];
      const queue: Entity[] = [m];
      visitedMonsters.add(m.id);

      while (queue.length > 0) {
        const current = queue.shift()!;
        group.push(current);

        // Find adjacent monsters
        const adjacent = monsters.filter(other => 
          !visitedMonsters.has(other.id) &&
          ((Math.abs(other.x - current.x) === 1 && other.y === current.y) ||
           (Math.abs(other.y - current.y) === 1 && other.x === current.x))
        );

        adjacent.forEach(adj => {
          visitedMonsters.add(adj.id);
          queue.push(adj);
        });
      }
      monsterGroups.push(group);
    });

    monsterGroups.forEach(group => {
      // Find bounding box
      const minX = Math.min(...group.map(m => m.x));
      const maxX = Math.max(...group.map(m => m.x));
      const minY = Math.min(...group.map(m => m.y));
      const maxY = Math.max(...group.map(m => m.y));

      // Check corners
      const isTopRight = maxX === currentWidth - 1 && minY === 0;
      const isTopLeft = minX === 0 && minY === 0;
      const isBottomRight = maxX === currentWidth - 1 && maxY === currentHeight - 1;
      const isBottomLeft = minX === 0 && maxY === currentHeight - 1;

      let pincerAllies: Entity[] = [];

      if (isTopRight) {
        // Left of the top-most enemy (which is at minY, but its x might not be minX, let's use the leftmost x at minY)
        const topMostLeftX = Math.min(...group.filter(m => m.y === minY).map(m => m.x));
        const leftAlly = players.find(p => p.x === topMostLeftX - 1 && p.y === minY);
        // Below the right-most enemy at maxY
        const bottomMostRightX = Math.max(...group.filter(m => m.y === maxY).map(m => m.x));
        const bottomAlly = players.find(p => p.x === bottomMostRightX && p.y === maxY + 1);
        if (leftAlly && bottomAlly) pincerAllies = [leftAlly, bottomAlly];
      } else if (isTopLeft) {
        const topMostRightX = Math.max(...group.filter(m => m.y === minY).map(m => m.x));
        const rightAlly = players.find(p => p.x === topMostRightX + 1 && p.y === minY);
        const bottomMostLeftX = Math.min(...group.filter(m => m.y === maxY).map(m => m.x));
        const bottomAlly = players.find(p => p.x === bottomMostLeftX && p.y === maxY + 1);
        if (rightAlly && bottomAlly) pincerAllies = [rightAlly, bottomAlly];
      } else if (isBottomRight) {
        const bottomMostLeftX = Math.min(...group.filter(m => m.y === maxY).map(m => m.x));
        const leftAlly = players.find(p => p.x === bottomMostLeftX - 1 && p.y === maxY);
        const topMostRightX = Math.max(...group.filter(m => m.y === minY).map(m => m.x));
        const topAlly = players.find(p => p.x === topMostRightX && p.y === minY - 1);
        if (leftAlly && topAlly) pincerAllies = [leftAlly, topAlly];
      } else if (isBottomLeft) {
        const bottomMostRightX = Math.max(...group.filter(m => m.y === maxY).map(m => m.x));
        const rightAlly = players.find(p => p.x === bottomMostRightX + 1 && p.y === maxY);
        const topMostLeftX = Math.min(...group.filter(m => m.y === minY).map(m => m.x));
        const topAlly = players.find(p => p.x === topMostLeftX && p.y === minY - 1);
        if (rightAlly && topAlly) pincerAllies = [rightAlly, topAlly];
      }

      if (pincerAllies.length === 2) {
        const targetTiles = group.map(m => ({ x: m.x, y: m.y }));
        pincerGroups.push({ allies: pincerAllies, monsters: group, targetTiles });
      }
    });

    // --- Horizontal Pincer Detection ---
    for (let y = 0; y < currentHeight; y++) {
      const alliesInRow = players.filter(p => p.y === y).sort((a, b) => a.x - b.x);
      for (let i = 0; i < alliesInRow.length - 1; i++) {
        const a1 = alliesInRow[i];
        const a2 = alliesInRow[i+1];
        if (a2.x - a1.x > 1) {
          let groupMonsters: Entity[] = [];
          let groupTiles: Point[] = [];
          let valid = true;
          for (let x = a1.x + 1; x < a2.x; x++) {
            const ent = getEntityAt(x, y);
            if (ent && ent.type === 'monster') {
              if (!groupMonsters.some(m => m.id === ent.entity.id)) groupMonsters.push(ent.entity);
              groupTiles.push({ x, y });
            } else {
              // Empty space or player in between breaks the pincer
              valid = false;
              break;
            }
          }
          if (valid && groupMonsters.length > 0) {
            pincerGroups.push({ allies: [a1, a2], monsters: groupMonsters, targetTiles: groupTiles });
          }
        }
      }
    }

    // --- Vertical Pincer Detection ---
    for (let x = 0; x < currentWidth; x++) {
      const alliesInCol = players.filter(p => p.x === x).sort((a, b) => a.y - b.y);
      for (let i = 0; i < alliesInCol.length - 1; i++) {
        const a1 = alliesInCol[i];
        const a2 = alliesInCol[i+1];
        if (a2.y - a1.y > 1) {
          let groupMonsters: Entity[] = [];
          let groupTiles: Point[] = [];
          let valid = true;
          for (let y = a1.y + 1; y < a2.y; y++) {
            const ent = getEntityAt(x, y);
            if (ent && ent.type === 'monster') {
              if (!groupMonsters.some(m => m.id === ent.entity.id)) groupMonsters.push(ent.entity);
              groupTiles.push({ x, y });
            } else {
              // Empty space or player in between breaks the pincer
              valid = false;
              break;
            }
          }
          if (valid && groupMonsters.length > 0) {
            pincerGroups.push({ allies: [a1, a2], monsters: groupMonsters, targetTiles: groupTiles });
          }
        }
      }
    }

    for (const group of pincerGroups) {
      anyPincerTriggered = true;
      const attackers = getChain(group.allies);
      // Sort attackers: moving character first, then others
      attackers.sort((a, b) => (a.id === movingCharId ? -1 : (b.id === movingCharId ? 1 : 0)));

      setPincerHighlights(group.targetTiles);
      dispatch({ type: 'LOG_MESSAGE', payload: `💥 夾擊觸發！目標：${group.monsters.map(m => `${m.name}(${m.id})`).join(', ')}` });

      for (const attacker of attackers) {
        // Try to trigger each of the 3 equipped skills
        const equippedSkills = attacker.equipped_skills || [attacker.skills[0]];
        
        for (const skillId of equippedSkills) {
          if (!skillId) continue;
          const skill = skills[skillId];
          if (!skill) continue;

          // Check trigger probability
          const triggerRate = calculateTriggerRate(attacker, skill);
          const roll = Math.random() * 100;
          
          if (roll > triggerRate) {
            dispatch({ type: 'LOG_MESSAGE', payload: `💨 ${attacker.name} 的 ${skill.name} 未能發動 (機率: ${Math.round(triggerRate)}%)` });
            continue;
          }

          // Calculate affected tiles based on skill type
          let affectedTiles: Point[] = [];
          if (skill.type === 'AREA') {
            // Union of 3x3 around each target tile
            group.targetTiles.forEach(t => {
              for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                  affectedTiles.push({ x: t.x + dx, y: t.y + dy });
                }
              }
            });
          } else if (skill.type === 'CROSS') {
            // Cross centered on each target
            group.targetTiles.forEach(t => {
              const maxDim = Math.max(currentWidth, currentHeight);
              for (let i = -maxDim; i < maxDim; i++) {
                affectedTiles.push({ x: t.x + i, y: t.y });
                affectedTiles.push({ x: t.x, y: t.y + i });
              }
            });
          } else if (skill.type === 'AROUND_1') {
            // 8 tiles around target
            group.targetTiles.forEach(t => {
              for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                  if (dx === 0 && dy === 0) continue;
                  affectedTiles.push({ x: t.x + dx, y: t.y + dy });
                }
              }
            });
          } else if (skill.type === 'AROUND_2') {
            // 24 tiles around target
            group.targetTiles.forEach(t => {
              for (let dx = -2; dx <= 2; dx++) {
                for (let dy = -2; dy <= 2; dy++) {
                  if (dx === 0 && dy === 0) continue;
                  affectedTiles.push({ x: t.x + dx, y: t.y + dy });
                }
              }
            });
          } else if (skill.type === 'CHAIN') {
            // All allies in the chain
            const chainAllies = getChain(group.allies);
            chainAllies.forEach(a => {
              affectedTiles.push({ x: a.x, y: a.y });
            });
          } else if (skill.type === 'SINGLE') {
            // Hits only the target tiles (for attacks) or the attacker (for heals)
            if (skill.damage > 0) {
              affectedTiles = [...group.targetTiles];
            } else {
              affectedTiles = [{ x: attacker.x, y: attacker.y }];
            }
          } else if (skill.type === 'SELF') {
            affectedTiles = [{ x: attacker.x, y: attacker.y }];
          } else if (skill.type === 'PINCER_ONLY') {
            affectedTiles = [...group.targetTiles];
          } else if (skill.type === 'ALL_ENEMIES') {
            monsters.forEach(m => affectedTiles.push({ x: m.x, y: m.y }));
          } else if (skill.type === 'ALL_ALLIES') {
            players.forEach(p => affectedTiles.push({ x: p.x, y: p.y }));
          } else if (skill.type === 'LOWEST_HP') {
            const lowest = [...players].sort((a, b) => (a.hp / a.max_hp) - (b.hp / b.max_hp))[0];
            if (lowest) affectedTiles = [{ x: lowest.x, y: lowest.y }];
          } else if (skill.type === 'ROW_1') {
            group.targetTiles.forEach(t => {
              for (let i = 0; i < currentWidth; i++) {
                affectedTiles.push({ x: i, y: t.y });
              }
            });
          } else if (skill.type === 'ROW_3') {
            group.targetTiles.forEach(t => {
              for (let dy = -1; dy <= 1; dy++) {
                for (let i = 0; i < currentWidth; i++) {
                  affectedTiles.push({ x: i, y: t.y + dy });
                }
              }
            });
          } else if (skill.type === 'COL_1') {
            group.targetTiles.forEach(t => {
              for (let i = 0; i < currentHeight; i++) {
                affectedTiles.push({ x: t.x, y: i });
              }
            });
          } else if (skill.type === 'COL_3') {
            group.targetTiles.forEach(t => {
              for (let dx = -1; dx <= 1; dx++) {
                for (let i = 0; i < currentHeight; i++) {
                  affectedTiles.push({ x: t.x + dx, y: i });
                }
              }
            });
          } else if (skill.type === 'LINE') {
            // Line through target (horizontal or vertical based on pincer)
            const isHorizontal = group.allies[0].y === group.allies[1].y;
            group.targetTiles.forEach(t => {
              if (isHorizontal) {
                for (let i = 0; i < currentWidth; i++) {
                  affectedTiles.push({ x: i, y: t.y });
                  if (skillId === 'meteor_shower') {
                    affectedTiles.push({ x: i, y: t.y - 1 });
                    affectedTiles.push({ x: i, y: t.y + 1 });
                  }
                }
              } else {
                for (let i = 0; i < currentHeight; i++) {
                  affectedTiles.push({ x: t.x, y: i });
                  if (skillId === 'meteor_shower') {
                    affectedTiles.push({ x: t.x - 1, y: i });
                    affectedTiles.push({ x: t.x + 1, y: i });
                  }
                }
              }
            });
          } else {
            // SELF: Around the attacker
            for (let dx = -1; dx <= 1; dx++) {
              for (let dy = -1; dy <= 1; dy++) {
                affectedTiles.push({ x: attacker.x + dx, y: attacker.y + dy });
              }
            }
          }

          // Filter unique tiles and within bounds
          const uniqueTiles = Array.from(new Set(affectedTiles.map(t => `${t.x},${t.y}`)))
            .map(s => {
              const [x, y] = s.split(',').map(Number);
              return { x, y };
            })
            .filter(t => t.x >= 0 && t.x < currentWidth && t.y >= 0 && t.y < currentHeight);

          // Trigger Animation
          dispatch({ 
            type: 'SET_SKILL_ANIMATION', 
            payload: { attacker_id: attacker.id, skill_id: skillId, affected_tiles: uniqueTiles } 
          });
          
          // Delay between skills for visual clarity - sped up by 20%
          await new Promise(r => setTimeout(r, 960));

          // Apply damage/healing to all entities in affected tiles
          const hitMonsters = monsters.filter(m => {
            const mSize = m.size || 1;
            for (let ox = 0; ox < mSize; ox++) {
              for (let oy = 0; oy < mSize; oy++) {
                if (uniqueTiles.some(t => t.x === m.x + ox && t.y === m.y + oy)) return true;
              }
            }
            return false;
          });

          const hitAllies = players.filter(p => {
            return uniqueTiles.some(t => t.x === p.x && t.y === p.y);
          });

          // Apply damage/healing based on skill type
          const finalDamage = calculateFinalDamage(attacker, skill.damage, skillId);
          if (skill.category === 'PHYSICAL' || skill.category === 'MAGIC') {
            // Attack skill: only hits monsters
            for (const m of hitMonsters) {
              dispatch({ type: 'LOG_MESSAGE', payload: `💥 ${attacker.name} 的 ${skill.name} 擊中了 ${m.name}！` });
              dispatch({ type: 'DAMAGE_ENTITY', payload: { id: m.id, damage: finalDamage } });
              
              // Apply status effects if any
              if (skill.effect === 'burn' && Math.random() > 0.5) {
                dispatch({ 
                  type: 'ADD_STATUS_EFFECT', 
                  payload: { 
                    entityId: m.id, 
                    effect: { 
                      id: generateId('effect-'), 
                      type: 'debuff', 
                      name: '燃燒', 
                      icon: '🔥', 
                      duration: 3, 
                      effect_type: 'burn', 
                      value: 5 
                    } 
                  } 
                });
                dispatch({ type: 'LOG_MESSAGE', payload: `🔥 ${m.name} 陷入了燃燒狀態！` });
              } else if (skill.effect === 'stun' && Math.random() > 0.7) {
                dispatch({ 
                  type: 'ADD_STATUS_EFFECT', 
                  payload: { 
                    entityId: m.id, 
                    effect: { 
                      id: generateId('effect-'), 
                      type: 'debuff', 
                      name: '眩暈', 
                      icon: '💫', 
                      duration: 1, 
                      effect_type: 'stun' 
                    } 
                  } 
                });
                dispatch({ type: 'LOG_MESSAGE', payload: `💫 ${m.name} 被震暈了！` });
              }
            }
          } else if (skill.category === 'HEAL') {
            // Healing skill: only hits allies
            for (const p of hitAllies) {
              dispatch({ type: 'LOG_MESSAGE', payload: `✨ ${attacker.name} 的 ${skill.name} 治療了 ${p.name}！` });
              dispatch({ type: 'DAMAGE_ENTITY', payload: { id: p.id, damage: finalDamage } });
            }
          } else if (skill.category === 'BUFF') {
            // Buff skill: only hits allies (or enemies for taunt)
            const targets = skill.effect === 'taunt' ? hitMonsters : hitAllies;
            for (const p of targets) {
              dispatch({ type: 'LOG_MESSAGE', payload: `${skill.effect === 'taunt' ? '💢' : '🛡️'} ${attacker.name} 的 ${skill.name} 影響了 ${p.name}！` });
              
              // Apply specific buff effects
              if (skill.effect === 'atk_up') {
                dispatch({ 
                  type: 'ADD_STATUS_EFFECT', 
                  payload: { 
                    entityId: p.id, 
                    effect: { 
                      id: generateId('effect-'), 
                      type: 'buff', 
                      name: '攻擊力上升', 
                      icon: '⚔️', 
                      duration: skill.duration || 3, 
                      effect_type: 'atk_up', 
                      value: 0.1 
                    } 
                  } 
                });
              } else if (skill.effect === 'def_up') {
                dispatch({ 
                  type: 'ADD_STATUS_EFFECT', 
                  payload: { 
                    entityId: p.id, 
                    effect: { 
                      id: generateId('effect-'), 
                      type: 'buff', 
                      name: '防禦力上升', 
                      icon: '🛡️', 
                      duration: skill.duration || 3, 
                      effect_type: 'def_up', 
                      value: 0.1 
                    } 
                  } 
                });
              } else if (skill.effect === 'shield') {
                dispatch({ 
                  type: 'ADD_STATUS_EFFECT', 
                  payload: { 
                    entityId: p.id, 
                    effect: { 
                      id: generateId('effect-'), 
                      type: 'buff', 
                      name: '護盾', 
                      icon: '🛡️', 
                      duration: skill.duration || 3, 
                      effect_type: 'shield', 
                      value: 50 
                    } 
                  } 
                });
              } else if (skill.effect === 'taunt') {
                dispatch({ 
                  type: 'ADD_STATUS_EFFECT', 
                  payload: { 
                    entityId: p.id, 
                    effect: { 
                      id: generateId('effect-'), 
                      type: 'debuff', 
                      name: '嘲諷', 
                      icon: '💢', 
                      duration: skill.duration || 2, 
                      effect_type: 'taunt', 
                      value: 0 
                    } 
                  } 
                });
              }
            }
          }

          await new Promise(r => setTimeout(r, 640));
          dispatch({ type: 'SET_SKILL_ANIMATION', payload: null });
          await new Promise(r => setTimeout(r, 240));
        }
      }
      
      setPincerHighlights([]);
      // Delay between multiple pincer attacks as requested - sped up by 20%
      await new Promise(r => setTimeout(r, 640));
    }

    dispatch({ type: 'REMOVE_DEAD' });
    
    // Small delay to allow state to settle for stateRef
    await new Promise(r => setTimeout(r, 100));

    // Check for Game Over after player turn (in case of friendly fire)
    const alivePlayers = stateRef.current.player_state.team.filter(p => p.hp > 0);
    if (alivePlayers.length === 0) {
      dispatch({ type: 'LOG_MESSAGE', payload: "💀 全軍覆沒，戰敗。" });
      dispatch({ type: 'GAME_OVER' });
      return;
    }
    
    // Always end turn if moved, even if no pincer
    if (currentMode === 'BATTLE') {
      await enemyTurn();
      // Tick status effects at the end of the round (after enemy turn)
      dispatch({ type: 'TICK_STATUS_EFFECTS' });
    }
  };

  const enemyTurn = async () => {
    const { game_mode: currentMode, battle_monsters: currentBattleMonsters, world_state } = stateRef.current;
    const monsters = currentMode === 'BATTLE' 
      ? currentBattleMonsters.filter(m => m.hp > 0)
      : world_state.entities_on_map.filter(m => m.hp > 0 && m.type === 'monster');
      
    const players = state.player_state.team.filter(p => p.hp > 0);
    const skills = state.world_state.skills_registry;
    
    if (monsters.length === 0) {
      // Calculate total EXP and SP from monsters
      const totalExp = currentBattleMonsters.reduce((sum, m) => sum + (m.exp || 0), 0);
      const totalSp = currentBattleMonsters.reduce((sum, m) => sum + (m.sp || 0), 0);
      const directExp = Math.floor(totalExp * 0.2);
      const tomeExpTotal = totalExp - directExp;
      
      // Fixed value for EXP Tome
      const TOME_VALUE = 50;
      const tomeCount = Math.ceil(tomeExpTotal / TOME_VALUE);

      dispatch({ type: 'LOG_MESSAGE', payload: `✨ 戰鬥勝利！獲得 ${directExp} 經驗、${tomeCount} 本經驗書(小) 與 ${totalSp} SP！` });
      dispatch({ type: 'CLEAR_BATTLE_BUFFS' });
      dispatch({ type: 'SET_MODE', payload: 'EXPLORATION' });
      
      // Award 20% XP and total SP to all team members
      stateRef.current.player_state.team.forEach(member => {
        dispatch({ type: 'GAIN_EXP', payload: { entityId: member.id, amount: directExp } });
        if (totalSp > 0) {
          dispatch({ type: 'GAIN_SP', payload: { entityId: member.id, amount: totalSp } });
        }
      });

      // Award 80% XP as fixed-value EXP Tomes
      for (let i = 0; i < tomeCount; i++) {
        dispatch({ 
          type: 'ADD_INVENTORY_ITEM', 
          payload: { 
            id: generateId('item-tome-'), 
            name: '初級經驗書', 
            description: `增加 ${TOME_VALUE} 點經驗值`, 
            type: 'EXP_TOME', 
            value: TOME_VALUE, 
            icon: '📖' 
          } 
        });
      }

      // Mark the encounter as defeated on world map
      if (stateRef.current.active_battle_id) {
        dispatch({ type: 'DAMAGE_ENTITY', payload: { id: stateRef.current.active_battle_id, damage: 9999 } });
        dispatch({ type: 'UPDATE_ENTITY_MEMORY', payload: { id: stateRef.current.active_battle_id, memory: '被玩家擊敗了' } });
      }
      dispatch({ type: 'REMOVE_DEAD' }); 
      return;
    }
    dispatch({ type: 'LOG_MESSAGE', payload: "🔴 敵人回合..." });
    await new Promise(r => setTimeout(r, 400));
    for (const monster of monsters) {
      const currentPlayers = stateRef.current.player_state.team.filter(p => p.hp > 0);
      if (currentPlayers.length === 0) break;
      
      // Check for stun
      if (monster.status_effects?.some(se => se.effect_type === 'stun')) {
        dispatch({ type: 'LOG_MESSAGE', payload: `⚠️ ${monster.name} 處於眩暈狀態，跳過回合。` });
        await new Promise(r => setTimeout(r, 320));
        continue;
      }

      const target = currentPlayers[Math.floor(Math.random() * currentPlayers.length)];
      if (target && monster.skills.length > 0) {
        const skillId = monster.equipped_skill_id || monster.skills[0];
        const skill = skills[skillId];
        if (skill) {
          // Trigger Animation for enemy attack
          dispatch({ 
            type: 'SET_SKILL_ANIMATION', 
            payload: { 
              attacker_id: monster.id, 
              skill_id: skillId, 
              affected_tiles: [{ x: target.x, y: target.y }] 
            } 
          });

          dispatch({ type: 'LOG_MESSAGE', payload: `🔴 ${monster.name} 使用了 ${skill.name} 攻擊 ${target.name}！` });
          
          // Wait for animation - sped up by 20%
          await new Promise(r => setTimeout(r, 800));
          
          dispatch({ type: 'DAMAGE_ENTITY', payload: { id: target.id, damage: skill.damage } });
          
          // Apply status effects if any
          if (skill.effect === 'stun' && Math.random() > 0.3) {
            dispatch({ 
              type: 'ADD_STATUS_EFFECT', 
              payload: { 
                entityId: target.id, 
                effect: { 
                  id: generateId('effect-'), 
                  type: 'debuff', 
                  name: '眩暈', 
                  icon: '💫', 
                  duration: 1, 
                  effect_type: 'stun' 
                } 
              } 
            });
            dispatch({ type: 'LOG_MESSAGE', payload: `💫 ${target.name} 被震暈了！` });
          }

          await new Promise(r => setTimeout(r, 640));
          dispatch({ type: 'SET_SKILL_ANIMATION', payload: null });
          await new Promise(r => setTimeout(r, 240));
        }
      }
    }
    const alivePlayersAtEnd = stateRef.current.player_state.team.filter(p => p.hp > 0);
    if (alivePlayersAtEnd.length === 0) {
      dispatch({ type: 'LOG_MESSAGE', payload: "💀 全軍覆沒，戰敗。" });
      dispatch({ type: 'CLEAR_BATTLE_BUFFS' });
      dispatch({ type: 'GAME_OVER' });
    }
  };

  const uniqueVisibleEntities = useMemo(() => {
    const entities = game_mode === 'EXPLORATION' 
      ? [team[0], ...entities_on_map].filter(Boolean)
      : [...team, ...battle_monsters].filter(Boolean);
      
    return Array.from(
      new Map(
        entities
          .filter(e => e.hp > 0 || e.type === 'npc' || e.type === 'boss_npc')
          .map(e => [e.id, e])
      ).values()
    );
  }, [game_mode, team, entities_on_map, battle_monsters]);



  const currentWidth = game_mode === 'BATTLE' ? BATTLE_GRID_WIDTH : map_data.width;
  const currentHeight = game_mode === 'BATTLE' ? BATTLE_GRID_HEIGHT : map_data.height;

  const currentGrid = useMemo(() => {
    if (game_mode === 'BATTLE') {
      // Clean 6x10 grid for battle
      return Array(BATTLE_GRID_HEIGHT).fill(0).map(() => Array(BATTLE_GRID_WIDTH).fill(0));
    }
    return map_data.grid;
  }, [game_mode, map_data.grid]);

  return (
    <div className={`flex flex-col items-center justify-center w-full h-full select-none relative ${shake ? 'animate-[shake_0.5s_infinite]' : ''}`} onClick={() => setSelectedEntityId(null)}>
      <style>{`
        @keyframes shake {
          0% { transform: translate(1px, 1px) rotate(0deg); }
          10% { transform: translate(-1px, -2px) rotate(-1deg); }
          20% { transform: translate(-3px, 0px) rotate(1deg); }
          30% { transform: translate(3px, 2px) rotate(0deg); }
          40% { transform: translate(1px, -1px) rotate(1deg); }
          50% { transform: translate(-1px, 2px) rotate(-1deg); }
          60% { transform: translate(-3px, 1px) rotate(0deg); }
          70% { transform: translate(3px, 1px) rotate(-1deg); }
          80% { transform: translate(-1px, -1px) rotate(1deg); }
          90% { transform: translate(1px, 2px) rotate(0deg); }
          100% { transform: translate(1px, -2px) rotate(-1deg); }
        }
      `}</style>
      <div 
        ref={gridRef}
        className="relative bg-[#0f0f0f] p-1 rounded-xl shadow-[0_30px_60px_rgba(0,0,0,0.9)] border-[6px] border-[#222] box-border"
        style={{
          width: currentWidth * (tileSize + gridGap) - gridGap + 20,
          height: currentHeight * (tileSize + gridGap) - gridGap + 20
        }}
      >
        <SkillAnimationOverlay state={state} tileSize={tileSize} gridGap={gridGap} />
        <DamageNumberDisplay state={state} dispatch={dispatch} tileSize={tileSize} gridGap={gridGap} />
        <MonsterInfoOverlay state={state} selectedEntityId={selectedEntityId} tileSize={tileSize} gridGap={gridGap} currentWidth={currentWidth} />
        
        {/* Guide Line */}
        {draggingId && dragPos && gridRef.current && (
          <svg className="absolute inset-0 pointer-events-none z-[90] w-full h-full overflow-visible">
            {(() => {
              const entity = team.find(p => p.id === draggingId);
              if (!entity) return null;
              const rect = gridRef.current.getBoundingClientRect();
              const startX = entity.x * (tileSize + gridGap) + tileSize / 2 + 10;
              const startY = entity.y * (tileSize + gridGap) + tileSize / 2 + 10;
              const endX = dragPos.x - rect.left;
              const endY = dragPos.y - rect.top;
              return (
                <line 
                  x1={startX} 
                  y1={startY} 
                  x2={endX} 
                  y2={endY} 
                  stroke="rgba(255, 255, 255, 0.4)" 
                  strokeWidth="2" 
                  strokeDasharray="4 4"
                />
              );
            })()}
          </svg>
        )}

        {/* Debug Glow / Pointer Follower */}
        {draggingId && dragPos && gridRef.current && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ 
              opacity: 1, 
              scale: 1,
              x: dragPos.x - gridRef.current.getBoundingClientRect().left - 20,
              y: dragPos.y - gridRef.current.getBoundingClientRect().top - 20
            }}
            className="absolute top-0 left-0 w-10 h-10 bg-yellow-400/30 rounded-full blur-xl pointer-events-none z-[110] border border-yellow-400/50"
          />
        )}

        {/* Grid Background */}
        <div 
          className="grid touch-none"
          style={{
            gridTemplateColumns: `repeat(${currentWidth}, ${tileSize}px)`,
            gridTemplateRows: `repeat(${currentHeight}, ${tileSize}px)`,
            gap: `${gridGap}px`
          }}
        >
          {currentGrid.map((row, y) =>
            row.map((terrain, x) => {
              const textureId = map_data.textureGrid?.[y]?.[x];
              // Only allow terrain textures (1-23) in the terrain layer
              const texture = (textureId && textureId >= 1 && textureId <= 23) ? TEXTURES[textureId] : null;
              
              // Hide objects in battle mode as requested
              const objectId = (game_mode === 'EXPLORATION' && map_data.objectGrid) ? map_data.objectGrid[y][x] : null;
              const objectTexture = objectId ? TEXTURES[objectId] : null;
              
              const terrainScale = texture ? tileSize / (texture.x2 - texture.x1 + 1) : 1;
              
              return (
                <div
                  key={`${x}-${y}`}
                  data-x={x}
                  data-y={y}
                  onMouseEnter={() => handleMouseEnter(x, y)}
                  onClick={(e) => handleTileClick(e, x, y)}
                  className={`w-full h-full flex items-center justify-center text-2xl relative transition-all duration-500 rounded-sm ${texture ? '' : TERRAIN_COLORS[terrain as TerrainType]} ${pincerHighlights.some(p => p.x === x && p.y === y) ? 'ring-4 ring-inset ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)] z-10' : ''} ${state.active_skill_animation?.affected_tiles.some(p => p.x === x && p.y === y) ? 'bg-white/40 ring-2 ring-white z-20 animate-pulse' : ''}`}
                >
                  {/* Terrain Layer */}
                  {texture && (
                    <div className="absolute inset-0 z-0 overflow-hidden">
                      <img 
                        src={`/Texture/${texture.fileName}`}
                        alt={texture.name}
                        referrerPolicy="no-referrer"
                        className="absolute max-w-none"
                        style={{
                          left: `-${texture.x1 * terrainScale}px`,
                          top: `-${texture.y1 * terrainScale}px`,
                          transform: `scale(${terrainScale})`,
                          transformOrigin: 'top left',
                          imageRendering: 'pixelated'
                        }}
                      />
                    </div>
                  )}

                  {/* Object Layer */}
                  {objectTexture && (
                    <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                      <div className="relative" style={{ width: tileSize, height: tileSize }}>
                        <div 
                          className="absolute bottom-0 left-1/2 -translate-x-1/2 overflow-hidden"
                          style={{
                            width: (objectTexture.x2 - objectTexture.x1 + 1) * (tileSize / 32),
                            height: (objectTexture.y2 - objectTexture.y1 + 1) * (tileSize / 32),
                          }}
                        >
                           <img 
                            src={`/Texture/${objectTexture.fileName}`}
                            alt={objectTexture.name}
                            referrerPolicy="no-referrer"
                            className="absolute max-w-none"
                            style={{
                              left: `-${objectTexture.x1 * (tileSize / 32)}px`,
                              top: `-${objectTexture.y1 * (tileSize / 32)}px`,
                              transform: `scale(${tileSize / 32})`,
                              transformOrigin: 'top left',
                              imageRendering: 'pixelated'
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={`absolute inset-0 border-[1px] border-white/5 pointer-events-none z-20`} />
                  
                  {/* Skill Effects Overlay */}
                  {state.active_skill_animation?.affected_tiles.some(p => p.x === x && p.y === y) && (
                    <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
                      {/* Fire Slash Around 1 */}
                      {state.active_skill_animation.skill_id === 'fire_slash_around1' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ 
                            opacity: [0, 1, 1, 0], 
                            scale: [0, 2.5, 2.5, 0],
                          }}
                          transition={{ duration: 1.2 }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <div className="absolute w-full h-full rounded-full bg-orange-500/60 blur-lg shadow-[0_0_40px_orange]" />
                          <div className="absolute w-[80%] h-[80%] rounded-full border-4 border-red-500 animate-spin" />
                        </motion.div>
                      )}

                      {/* Arrow Rain Effect */}
                      {(state.active_skill_animation.skill_id === 'arrow_rain_1' || state.active_skill_animation.skill_id === 'arrow_rain_2') && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: [0, 1, 1, 0] }}
                          transition={{ duration: 1.5 }}
                          className="w-full h-full relative overflow-hidden"
                        >
                          {[...Array(12)].map((_, i) => (
                            <motion.div
                              key={i}
                              initial={{ y: -150, x: (Math.random() - 0.5) * 60, opacity: 0, rotate: 15 }}
                              animate={{ 
                                y: [ -150, 150 ],
                                opacity: [0, 1, 1, 0]
                              }}
                              transition={{ 
                                duration: 0.4, 
                                delay: i * 0.08,
                                repeat: 1,
                                ease: "linear"
                              }}
                              className="absolute left-1/2 w-[2px] h-10 bg-gradient-to-b from-transparent via-gray-300 to-white rounded-full shadow-[0_0_8px_white]"
                            />
                          ))}
                          <motion.div 
                            animate={{ opacity: [0, 0.4, 0] }}
                            transition={{ duration: 0.2, delay: 0.5 }}
                            className="absolute inset-0 bg-white blur-xl"
                          />
                        </motion.div>
                      )}

                      {/* Buff Effect (ATK UP / DEF UP) */}
                      {(state.active_skill_animation.skill_id === 'atk_up_self' || state.active_skill_animation.skill_id === 'def_up_self' || state.active_skill_animation.skill_id === 'def_up_col1') && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ 
                            opacity: [0, 1, 1, 0], 
                            y: [20, -20],
                          }}
                          transition={{ duration: 1.2 }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <div className={`w-full h-full rounded-full ${state.active_skill_animation.skill_id.includes('atk') ? 'bg-red-400/30' : 'bg-blue-400/30'} blur-md`} />
                          <div className="text-2xl animate-bounce">
                            {state.active_skill_animation.skill_id.includes('atk') ? '⚔️' : '🛡️'}
                          </div>
                        </motion.div>
                      )}

                      {/* Heal Large Chain */}
                      {state.active_skill_animation.skill_id === 'heal_large_chain' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ 
                            opacity: [0, 1, 1, 0], 
                            scale: [0, 1.5, 1.5, 0],
                          }}
                          transition={{ duration: 1.2 }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <div className="w-full h-full rounded-full bg-green-400/40 blur-xl shadow-[0_0_40px_green]" />
                          <div className="absolute inset-0 flex items-center justify-center text-green-200 text-3xl animate-pulse">➕</div>
                        </motion.div>
                      )}

                      {/* Group Shield */}
                      {state.active_skill_animation.skill_id === 'group_shield' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ 
                            opacity: [0, 1, 1, 0], 
                            scale: [0.5, 1.3, 1.3, 0.5],
                          }}
                          transition={{ duration: 1.2 }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <div className="w-full h-full rounded-full border-4 border-cyan-400 bg-cyan-400/10 blur-[1px] shadow-[0_0_25px_cyan]" />
                          <div className="absolute inset-0 flex items-center justify-center text-cyan-200 text-2xl opacity-50">🛡️</div>
                        </motion.div>
                      )}

                      {state.active_skill_animation.skill_id === 'fire_slash' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0, rotate: 0 }}
                          animate={{ 
                            opacity: [0, 1, 1, 0], 
                            scale: [0, 2, 2.2, 0],
                            rotate: [0, 180, 360, 450]
                          }}
                          transition={{ duration: 1.0, times: [0, 0.2, 0.8, 1] }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          {/* Core Fire */}
                          <div className="absolute w-full h-full rounded-full bg-gradient-to-br from-red-500 via-orange-600 to-yellow-400 blur-md opacity-90 shadow-[0_0_30px_rgba(239,68,68,0.8)]" />
                          {/* Outer Glow */}
                          <div className="absolute w-[120%] h-[120%] rounded-full bg-red-600/30 blur-xl animate-pulse" />
                          {/* Sparks/Particles */}
                          <div className="absolute w-full h-full">
                            {[...Array(6)].map((_, i) => (
                              <motion.div
                                key={i}
                                animate={{ 
                                  y: [0, -40], 
                                  x: [0, (i - 3) * 15],
                                  opacity: [1, 0],
                                  scale: [1, 0]
                                }}
                                transition={{ duration: 1.5, delay: i * 0.1, repeat: Infinity }}
                                className="absolute top-1/2 left-1/2 w-2 h-2 bg-yellow-400 rounded-full blur-[1px]"
                              />
                            ))}
                          </div>
                          {/* Shockwave */}
                          <div className="absolute w-full h-full rounded-full border-8 border-red-500/40 animate-ping opacity-60" />
                        </motion.div>
                      )}
                      {state.active_skill_animation.skill_id === 'heal_light' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ 
                            opacity: [0, 1, 1, 0], 
                            scale: [0, 1.2, 1.2, 0],
                          }}
                          transition={{ duration: 1.0 }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <div className="w-full h-full rounded-full bg-cyan-400/40 blur-md shadow-[0_0_30px_cyan]" />
                          <div className="absolute w-1/2 h-1/2 bg-white rounded-full blur-sm animate-pulse" />
                        </motion.div>
                      )}
                      {state.active_skill_animation.skill_id === 'meteor_shower' && (
                        <motion.div 
                          initial={{ opacity: 0, y: -100, scale: 0.5 }}
                          animate={{ 
                            opacity: [0, 1, 1, 0], 
                            y: [-100, 0, 0, 0], 
                            scale: [0.5, 1, 2, 0] 
                          }}
                          transition={{ duration: 1.0 }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <div className="w-full h-full rounded-full bg-white shadow-[0_0_40px_white] blur-sm" />
                          <div className="absolute inset-0 bg-gradient-to-t from-yellow-500 to-transparent opacity-60" />
                        </motion.div>
                      )}

                      {/* Bite Effect */}
                      {state.active_skill_animation.skill_id === 'bite' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ 
                            opacity: [0, 1, 1, 0], 
                            scale: [0.5, 1.2, 1, 0],
                          }}
                          transition={{ duration: 0.8 }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <div className="relative w-full h-full flex items-center justify-center">
                            <motion.div 
                              animate={{ scale: [1, 2], opacity: [1, 0] }}
                              className="absolute inset-0 bg-red-600/40 rounded-full blur-xl"
                            />
                            <span className="text-4xl filter drop-shadow-[0_0_10px_rgba(255,0,0,0.8)]">🦷</span>
                          </div>
                        </motion.div>
                      )}

                      {/* Fire Nova Effect */}
                      {state.active_skill_animation.skill_id === 'fire_nova' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ 
                            opacity: [0, 1, 0], 
                            scale: [0, 4],
                          }}
                          transition={{ duration: 0.8 }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <div className="w-full h-full rounded-full border-[20px] border-orange-500 blur-md shadow-[0_0_50px_orange]" />
                          <div className="absolute w-full h-full rounded-full border-[10px] border-red-600 blur-sm" />
                        </motion.div>
                      )}

                      {/* Holy Shield Effect */}
                      {state.active_skill_animation.skill_id === 'holy_shield' && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ 
                            opacity: [0, 1, 1, 0], 
                            scale: [0.8, 1.2, 1.2, 0.8],
                          }}
                          transition={{ duration: 1.2 }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <div className="w-full h-full rounded-full border-4 border-yellow-400 bg-yellow-400/20 blur-[2px] shadow-[0_0_20px_gold]" />
                          <div className="absolute inset-0 flex items-center justify-center text-yellow-200 text-2xl opacity-40">✨</div>
                        </motion.div>
                      )}

                      {/* Earthquake Effect */}
                      {state.active_skill_animation.skill_id === 'earthquake' && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ 
                            opacity: [0, 1, 1, 0],
                          }}
                          transition={{ duration: 1.0 }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <div className="w-full h-full bg-amber-900/40 blur-sm" />
                          <div className="absolute w-full h-1 bg-amber-800 rotate-12 translate-y-2" />
                          <div className="absolute w-full h-1 bg-amber-800 -rotate-12 -translate-y-2" />
                        </motion.div>
                      )}

                      {/* Thunder Strike Effect */}
                      {state.active_skill_animation.skill_id === 'thunder_strike' && (
                        <motion.div 
                          initial={{ opacity: 0, scaleY: 0 }}
                          animate={{ 
                            opacity: [0, 1, 0, 1, 0], 
                            scaleY: [0, 1, 1, 1, 1],
                          }}
                          transition={{ duration: 0.6 }}
                          className="w-full h-full flex items-center justify-center origin-top"
                        >
                          <div className="w-2 h-[500%] bg-cyan-300 shadow-[0_0_30px_cyan] blur-[1px]" />
                          <div className="absolute w-6 h-[500%] bg-white/30 blur-xl" />
                        </motion.div>
                      )}

                      {/* Generic Slash / Attack for enemies */}
                      {(state.active_skill_animation.skill_id === 'boss_smash' || !['fire_slash', 'heal_light', 'meteor_shower', 'bite'].includes(state.active_skill_animation.skill_id)) && (
                        <motion.div 
                          initial={{ opacity: 0, x: -50, rotate: -45 }}
                          animate={{ 
                            opacity: [0, 1, 1, 0], 
                            x: [-50, 50],
                            rotate: [-45, 45]
                          }}
                          transition={{ duration: 0.6 }}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <div className="w-1 h-[150%] bg-white shadow-[0_0_15px_white] rotate-45 blur-[1px]" />
                        </motion.div>
                      )}
                      {/* Default highlight */}
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 0.4, 0.4, 0] }}
                        transition={{ duration: 1.0 }}
                        className="absolute inset-0 bg-white"
                      />
                    </div>
                  )}

                  {current_path.some(p => p.x === x && p.y === y) && game_mode === 'EXPLORATION' && (
                    <div className="absolute w-2 h-2 bg-yellow-400/30 rounded-full animate-ping z-30" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Entities Layer */}
        <AnimatePresence>
          {uniqueVisibleEntities.map((entity) => {
            const size = entity.size || 1;
            const isDragging = draggingId === entity.id;
            const isSwapped = lastSwappedId === entity.id;
            
            // Calculate smooth drag position
            let displayX = entity.x * (tileSize + gridGap);
            let displayY = entity.y * (tileSize + gridGap);
            
            if (isDragging && dragPos && gridRef.current) {
              const rect = gridRef.current.getBoundingClientRect();
              const relX = dragPos.x - rect.left - 10;
              const relY = dragPos.y - rect.top - 10;
              
              // Smoothly follow cursor during drag
              const offset = tileSize * 0.3;
              const targetX = Math.floor(relX / (tileSize + gridGap));
              const targetY = Math.floor(relY / (tileSize + gridGap));

              if (isPathValid({ x: entity.x, y: entity.y }, { x: targetX, y: targetY })) {
                displayX = relX - (tileSize * size) / 2 - offset;
                displayY = relY - (tileSize * size) / 2 - offset;
              } else {
                // If path is invalid, we allow the sprite to move towards the obstacle
                // but clamp the center point so it doesn't enter the invalid tile.
                // This allows the "half-tile overlap" the user requested.
                const minX = entity.x * (tileSize + gridGap);
                const maxX = (entity.x + 1) * (tileSize + gridGap) - 1;
                const minY = entity.y * (tileSize + gridGap);
                const maxY = (entity.y + 1) * (tileSize + gridGap) - 1;
                
                const clampedX = Math.max(minX, Math.min(maxX, relX));
                const clampedY = Math.max(minY, Math.min(maxY, relY));
                
                displayX = clampedX - (tileSize * size) / 2 - offset;
                displayY = clampedY - (tileSize * size) / 2 - offset;
              }
            }

            const isBeingHit = state.damage_numbers.some(dn => dn.id.includes(entity.id));
            const isStunned = entity.status_effects?.some(se => se.effect_type === 'stun');

            return (
              <motion.div
                key={entity.id}
                initial={false}
                animate={{ 
                  x: displayX, 
                  y: displayY,
                  scale: isSwapped ? 1.1 : 1,
                  rotate: 0,
                  zIndex: isDragging ? 100 : 30,
                  filter: isDragging 
                    ? 'brightness(1.4) drop-shadow(0 0 20px gold)' 
                    : (isBeingHit 
                        ? 'brightness(2) drop-shadow(0 0 10px white)' 
                        : (entity.hp <= 0 ? 'grayscale(1) opacity(0.5)' : (isStunned ? 'grayscale(0.8) opacity(0.8)' : 'none')))
                }}
                transition={{ 
                  type: isDragging ? 'tween' : 'spring', 
                  duration: isDragging ? 0.05 : 0.4,
                  stiffness: 400, 
                  damping: 30,
                  mass: 0.8
                }}
                onMouseDown={(e) => handleMouseDown(e, entity)}
                onTouchStart={(e) => handleTouchStart(e, entity)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (entity.type === 'monster' || entity.type === 'npc' || entity.type === 'boss_npc') {
                    setSelectedEntityId(entity.id);
                  }
                }}
                className={`absolute top-1 left-1 flex flex-col items-center justify-center cursor-grab active:cursor-grabbing touch-none ${isDragging ? 'pointer-events-none' : 'pointer-events-auto'} ${selectedEntityId === entity.id ? 'ring-2 ring-yellow-400 rounded-lg bg-yellow-400/10' : ''}`}
                style={{
                  width: tileSize * size + (size - 1) * gridGap,
                  height: tileSize * size + (size - 1) * gridGap
                }}
              >
                {game_mode === 'EXPLORATION' && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/60 px-1.5 py-0.5 rounded text-[8px] text-white whitespace-nowrap border border-white/10">
                    {entity.name}
                  </div>
                )}
                <StatusEffectsDisplay entity={entity} />
                <motion.span 
                  animate={isSwapped ? { scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] } : {}}
                  className={`drop-shadow-[0_8px_8px_rgba(0,0,0,0.8)] ${size > 1 ? 'text-6xl sm:text-7xl' : 'text-3xl sm:text-4xl'}`}
                >
                  {entity.avatar}
                </motion.span>

                {/* HP Bar - Inside the tile, thinner and lower */}
                {entity.hp > 0 && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[70%] h-1.5 bg-black/80 rounded-sm border border-white/10 overflow-hidden z-40">
                    <motion.div 
                      initial={false}
                      animate={{ width: `${(entity.hp / entity.max_hp) * 100}%` }}
                      className={`h-full ${
                        entity.type === 'player' 
                          ? 'bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.6)]' 
                          : 'bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]'
                      }`}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

