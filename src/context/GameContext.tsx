import React, { createContext, useReducer, ReactNode } from 'react';
import { isSolidObject } from '../constants/textures';

// --- Utilities ---
let idCounter = 0;
export const generateId = (prefix: string = '') => {
  idCounter++;
  const random = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now().toString(36);
  const counterStr = idCounter.toString(36);
  return `${prefix}${timestamp}-${random}-${counterStr}`;
};

export const findSafePositions = (grid: TerrainType[][], count: number, objectGrid?: (number | null)[][]): { x: number, y: number }[] => {
  const positions: { x: number, y: number }[] = [];
  const height = grid.length;
  if (height === 0) return positions;
  const width = grid[0].length;

  // Try to find positions that are not only passable but also have some space around them
  // We'll scan from left to right, top to bottom, but skip the very edges (usually walls)
  for (let x = 1; x < width - 1 && positions.length < count; x++) {
    for (let y = 1; y < height - 1 && positions.length < count; y++) {
      const terrain = grid[y][x];
      const isPassable = terrain === 0 || terrain === 4;
      const objectId = objectGrid ? objectGrid[y][x] : null;
      const isObjectSolid = objectId !== null && isSolidObject(objectId);
      
      if (isPassable && !isObjectSolid) {
        // Check if it's not a complete dead end (at least 2 neighbors should be passable)
        let passableNeighbors = 0;
        const neighbors = [[0,1], [0,-1], [1,0], [-1,0]];
        for (const [dx, dy] of neighbors) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nTerrain = grid[ny][nx];
            const nObjectId = objectGrid ? objectGrid[ny][nx] : null;
            if ((nTerrain === 0 || nTerrain === 4) && !(nObjectId !== null && isSolidObject(nObjectId))) {
              passableNeighbors++;
            }
          }
        }

        if (passableNeighbors >= 2) {
          if (!positions.some(p => p.x === x && p.y === y)) {
            positions.push({ x, y });
          }
        }
      }
    }
  }
  
  // Fallback if not enough "good" positions found, just take any passable ones
  if (positions.length < count) {
    for (let x = 1; x < width - 1 && positions.length < count; x++) {
      for (let y = 1; y < height - 1 && positions.length < count; y++) {
        const terrain = grid[y][x];
        const isPassable = terrain === 0 || terrain === 4;
        const objectId = objectGrid ? objectGrid[y][x] : null;
        const isObjectSolid = objectId !== null && isSolidObject(objectId);
        if (isPassable && !isObjectSolid && !positions.some(p => p.x === x && p.y === y)) {
          positions.push({ x, y });
        }
      }
    }
  }
  
  // Ultimate fallback
  while (positions.length < count) {
    positions.push({ x: 1, y: 1 + (positions.length % (height - 2)) });
  }
  
  return positions;
};

export const calculateTriggerRate = (attacker: Entity, skill: Skill) => {
  if (attacker.type === 'monster') return skill.base_trigger_rate || 100;
  
  // Terra Battle inspired trigger rate formula:
  // Base Rate + (Level * 0.5) + (SB * 1)
  // Low level characters have lower chance for high tier skills
  const levelBonus = (attacker.level || 1) * 0.5;
  const sbBonus = (attacker.sb || 0);
  
  // Higher tier skills (higher sp_cost) are harder to trigger at low levels
  const tierPenalty = Math.max(0, (skill.sp_cost || 0) / 10);
  
  const finalRate = (skill.base_trigger_rate || 50) + levelBonus + sbBonus - tierPenalty;
  return Math.min(100, Math.max(0, finalRate));
};

// Helper to ensure unique entities by ID
const ensureUniqueEntities = (entities: Entity[]): Entity[] => {
  const seen = new Set<string>();
  const unique = entities.filter(e => {
    if (!e || !e.id) return false;
    if (seen.has(e.id)) {
      console.warn(`Duplicate entity ID detected in state: ${e.id}`, e);
      return false;
    }
    seen.add(e.id);
    return true;
  });
  return unique;
};

// --- Types & Interfaces ---
export type TerrainType = 0 | 1 | 2 | 3 | 4;

export interface MapData {
  width: number;
  height: number;
  grid: TerrainType[][];
  textureGrid?: number[][];
  objectGrid?: (number | null)[][];
}

export type SkillType = 'AREA' | 'CROSS' | 'SELF' | 'LINE' | 'SINGLE' | 'ROW_1' | 'ROW_3' | 'COL_1' | 'COL_3' | 'AROUND_1' | 'AROUND_2' | 'CHAIN' | 'PINCER_ONLY' | 'ALL_ENEMIES' | 'ALL_ALLIES' | 'LOWEST_HP';

export type ClassType = 'MELEE' | 'RANGED' | 'MAGIC' | 'NONE';
export enum JobType {
  SWORDSMAN = 'SWORDSMAN',
  ARCHER = 'ARCHER',
  TANK = 'TANK',
  HEALER = 'HEALER',
  MONSTER = 'MONSTER',
  // Advanced Jobs
  ADV_SWORDSMAN = '進階劍士',
  ADV_ARCHER = '進階弓手',
  ADV_TANK = '進階坦克',
  ADV_HEALER = '進階治療師'
}

export interface StatusEffect {
  id: string;
  type: 'buff' | 'debuff';
  name: string;
  icon: string;
  duration: number; // in turns
  effect_type: 'atk_up' | 'def_up' | 'poison' | 'regen' | 'stun' | 'burn' | 'haste' | 'slow' | 'shield';
  value?: number;
}

export interface Skill {
  id: string;
  name: string;
  damage: number;
  type: SkillType;
  category: 'PHYSICAL' | 'MAGIC' | 'HEAL' | 'BUFF';
  description: string;
  base_trigger_rate: number; // 0-100
  evolution_of?: string;
  prerequisites?: string[];
  sp_cost?: number;
  required_level?: number;
  owner_ids?: string[]; // List of character IDs who can learn this skill
  duration?: number; // Duration of status effects in turns
  effect?: string;
  tree_pos?: { x: number; y: number };
}

export interface SkillCombo {
  id: string;
  name: string;
  description: string;
  required_skills: string[]; // List of skill IDs required
  bonus_type: 'PASSIVE' | 'ACTIVE';
  bonus_value?: number;
  effect_type?: string; // e.g., 'fire_damage_boost'
}

export interface Entity {
  id: string;
  name: string;
  avatar: string;
  type: 'monster' | 'npc' | 'player' | 'boss_npc' | 'chest';
  class_type: ClassType;
  job_type: JobType;
  ref_id?: string;
  x: number;
  y: number;
  hp: number;
  max_hp: number;
  atk: number;
  def: number;
  skills: string[]; // List of all learned skill IDs
  equipped_skills: string[]; // Up to 3 equipped skill IDs
  sp: number; // Skill points (used to learn skills)
  exp: number; // Experience points (used to level up)
  level: number; // Character level
  sb: number; // Skill Boost (0-100)
  job_index?: number; // 0, 1, or 2
  size?: number; // 1 for normal, 2 for 2x2 boss
  status_effects?: StatusEffect[];
  unlocked_combos?: string[]; // List of combo IDs
  shield?: number; // Current shield value
  memory?: string[]; // Memory of past interactions (e.g., battles)
}

export const getExpToNextLevel = (level: number) => {
  return Math.floor(100 * Math.pow(1.2, level - 1));
};

export type GameMode = 'EXPLORATION' | 'BATTLE' | 'DIALOGUE' | 'MENU';

export interface DialogueState {
  npc: Entity;
  messages: { role: 'npc' | 'player'; content: string }[];
  is_loading: boolean;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  type: 'HEAL' | 'BUFF' | 'KEY' | 'EXP_TOME' | 'MATERIAL';
  value: number;
  icon: string;
  quantity?: number;
}

export interface LevelUpAnimation {
  id: string;
  entityId: string;
  x: number;
  y: number;
  name: string;
  level: number;
}

export interface GameState {
  user: {
    uid: string;
    displayName: string;
    level: number;
    exp: number;
    gold: number;
    photoURL?: string;
  } | null | undefined;
  game_mode: GameMode;
  stage: number;
  active_battle_id: string | null;
  player_state: {
    inventory: Item[];
    team: Entity[]; // Current active team
    all_characters: Entity[]; // All owned characters
    backpack: Item[]; // Items in backpack
    stats: any;
    team_slots: number; // Number of available slots (3-6)
    user?: any; // Keep for backward compatibility if needed, but we should use state.user
  };
  world_state: {
    map_data: MapData;
    entities_on_map: Entity[];
    skills_registry: Record<string, Skill>;
    skill_combos: Record<string, SkillCombo>;
  };
  memory_fragments: string[];
  pending_buffer: any | null;
  current_path: { x: number; y: number }[];
  combat_log: { id: string; text: string }[];
  damage_numbers: { id: string; x: number; y: number; amount: number; type: 'damage' | 'heal' }[];
  level_up_animations: LevelUpAnimation[];
  active_skill_animation: {
    attacker_id: string;
    skill_id: string;
    affected_tiles: { x: number; y: number }[];
  } | null;
  active_dialogue: DialogueState | null;
  battle_monsters: Entity[];
  last_dialogue_npc_id: string | null;
  is_game_over: boolean;
}

// --- Initial State ---
const SKILL_COMBOS: Record<string, SkillCombo> = {
  'elemental_synergy': { 
    id: 'elemental_synergy', 
    name: '元素共鳴', 
    description: '同時掌握強大的火焰與大地之力，提升 15% 的技能傷害', 
    required_skills: ['fire_slash_2', 'meteor_shower_2'], 
    bonus_type: 'PASSIVE', 
    bonus_value: 0.15 
  },
  'holy_fire': { 
    id: 'holy_fire', 
    name: '聖火洗禮', 
    description: '神聖與火焰的結合，提升 10% 的治療效果與火焰傷害', 
    required_skills: ['fire_slash_2', 'heal_light_2'], 
    bonus_type: 'PASSIVE', 
    bonus_value: 0.10 
  },
  'storm_lord': { 
    id: 'storm_lord', 
    name: '風暴領主', 
    description: '掌控雷電與星辰，提升 20% 的雷鳴術傷害', 
    required_skills: ['thunder_strike', 'meteor_shower_3'], 
    bonus_type: 'PASSIVE', 
    bonus_value: 0.20 
  }
};

const checkUnlockedCombos = (skills: string[]): string[] => {
  return Object.values(SKILL_COMBOS)
    .filter(combo => combo.required_skills.every(reqId => skills.includes(reqId)))
    .map(combo => combo.id);
};

export const CHARACTER_POOL: Entity[] = [
  { id: 'hero_1', name: '艾爾文', avatar: '⚔️', type: 'player', class_type: 'MELEE', job_type: JobType.SWORDSMAN, ref_id: 'hero_1', x: 0, y: 0, hp: 120, max_hp: 120, atk: 25, def: 15, skills: ['fire_slash_row1', 'quick_slash_pincer'], equipped_skills: ['fire_slash_row1', 'quick_slash_pincer'], sp: 0, exp: 0, level: 1, sb: 0, shield: 0 },
  { id: 'hero_2', name: '莉亞', avatar: '🪄', type: 'player', class_type: 'MAGIC', job_type: JobType.HEALER, ref_id: 'hero_2', x: 0, y: 0, hp: 80, max_hp: 80, atk: 35, def: 8, skills: ['heal_single_1', 'magic_shield_self'], equipped_skills: ['heal_single_1', 'magic_shield_self'], sp: 0, exp: 0, level: 1, sb: 0, shield: 0 },
  { id: 'hero_3', name: '巴恩', avatar: '🛡️', type: 'player', class_type: 'MELEE', job_type: JobType.TANK, ref_id: 'hero_3', x: 0, y: 0, hp: 150, max_hp: 150, atk: 20, def: 25, skills: ['def_up_self', 'heavy_strike_pincer', 'heal_self_small', 'def_up_self_1t'], equipped_skills: ['def_up_self', 'heavy_strike_pincer', 'heal_self_small'], sp: 0, exp: 0, level: 1, sb: 0, shield: 0 },
  { id: 'hero_4', name: '希露菲', avatar: '🏹', type: 'player', class_type: 'RANGED', job_type: JobType.ARCHER, ref_id: 'hero_4', x: 0, y: 0, hp: 90, max_hp: 90, atk: 30, def: 12, skills: ['arrow_rain_1', 'double_shot_pincer'], equipped_skills: ['arrow_rain_1', 'double_shot_pincer'], sp: 0, exp: 0, level: 1, sb: 0, shield: 0 },
  { id: 'hero_5', name: '凱恩', avatar: '🧙', type: 'player', class_type: 'MAGIC', job_type: JobType.SWORDSMAN, ref_id: 'hero_5', x: 0, y: 0, hp: 85, max_hp: 85, atk: 40, def: 10, skills: ['meteor_small', 'mana_burst_pincer'], equipped_skills: ['meteor_small', 'mana_burst_pincer'], sp: 0, exp: 0, level: 1, sb: 0, shield: 0 },
  { id: 'hero_6', name: '莫妮卡', avatar: '💃', type: 'player', class_type: 'RANGED', job_type: JobType.ARCHER, ref_id: 'hero_6', x: 0, y: 0, hp: 100, max_hp: 100, atk: 28, def: 14, skills: ['inspire_dance', 'step_dance_pincer'], equipped_skills: ['inspire_dance', 'step_dance_pincer'], sp: 0, exp: 0, level: 1, sb: 0, shield: 0 },
];

// Randomly pick 3 for initial team
const shuffle = (array: any[]) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const initialMapData = {
  width: 10,
  height: 10,
  grid: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 3, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  ] as TerrainType[][]
};

const initialSafePositions = findSafePositions(initialMapData.grid, 3);
const initialTeam = shuffle(CHARACTER_POOL).slice(0, 3).map((p, idx) => ({ 
  ...p, 
  x: initialSafePositions[idx]?.x ?? 1, 
  y: initialSafePositions[idx]?.y ?? (1 + idx) 
}));

const initialState: GameState = {
  user: undefined,
  game_mode: 'EXPLORATION',
  stage: 1,
  active_battle_id: null,
  player_state: {
    team: initialTeam,
    all_characters: [...CHARACTER_POOL],
    backpack: [
      { id: 'item_potion_1', name: '小瓶生命藥水', description: '恢復 30 點生命值', type: 'HEAL', value: 30, icon: '🧪' },
      { id: 'item_potion_2', name: '大瓶生命藥水', description: '恢復 80 點生命值', type: 'HEAL', value: 80, icon: '⚗️' },
      { id: 'item_tome_1', name: '初級經驗書', description: '增加 50 點經驗值', type: 'EXP_TOME', value: 50, icon: '📖' },
      { id: 'item_key_1', name: '神秘鑰匙', description: '似乎可以用來打開某種鎖', type: 'KEY', value: 0, icon: '🔑' },
    ],
    inventory: [],
    stats: {},
    team_slots: 3
  },
  world_state: {
    map_data: {
      width: 10,
      height: 10,
      grid: [],
      textureGrid: [],
      objectGrid: []
    },
    entities_on_map: [],
    skills_registry: {
      // --- 艾爾文 (hero_1) - 劍士專屬 ---
      'fire_slash_row1': { id: 'fire_slash_row1', name: '烈焰斬 橫1列', damage: 15, type: 'ROW_1', category: 'PHYSICAL', description: '對橫向 1 列的敵人造成火焰傷害', base_trigger_rate: 80, sp_cost: 0, required_level: 1, owner_ids: ['hero_1'], effect: 'burn', tree_pos: { x: 50, y: 50 } },
      'fire_slash_around1': { id: 'fire_slash_around1', name: '烈焰斬 周圍1', damage: 20, type: 'AROUND_1', category: 'PHYSICAL', description: '對周圍 1 圈的敵人造成火焰傷害', base_trigger_rate: 70, evolution_of: 'fire_slash_row1', sp_cost: 30, required_level: 5, owner_ids: ['hero_1'], effect: 'burn', tree_pos: { x: 50, y: 150 } },
      'fire_slash_cross': { id: 'fire_slash_cross', name: '烈焰斬 十字', damage: 35, type: 'CROSS', category: 'PHYSICAL', description: '對十字範圍的敵人造成大量火焰傷害', base_trigger_rate: 40, evolution_of: 'fire_slash_around1', sp_cost: 60, required_level: 15, owner_ids: ['hero_1'], tree_pos: { x: 50, y: 250 } },
      'sword_wave': { id: 'sword_wave', name: '真空劍氣 直線', damage: 25, type: 'LINE', category: 'PHYSICAL', description: '發出直線劍氣貫穿敵人', base_trigger_rate: 50, sp_cost: 40, required_level: 10, owner_ids: ['hero_1'], tree_pos: { x: 130, y: 150 } },
      'quick_slash_pincer': { id: 'quick_slash_pincer', name: '疾風斬 受夾擊目標', damage: 18, type: 'PINCER_ONLY', category: 'PHYSICAL', description: '對受夾擊的目標發動快速斬擊', base_trigger_rate: 90, sp_cost: 0, required_level: 1, owner_ids: ['hero_1'], tree_pos: { x: 130, y: 50 } },
      
      // --- 莉亞 (hero_2) - 治療師專屬 ---
      'heal_single_1': { id: 'heal_single_1', name: '微弱治癒 單體', damage: -15, type: 'SINGLE', category: 'HEAL', description: '恢復單體目標少量生命值', base_trigger_rate: 90, sp_cost: 0, required_level: 1, owner_ids: ['hero_2'], tree_pos: { x: 500, y: 50 } },
      'heal_mid_single': { id: 'heal_mid_single', name: '中級治癒 單體(血量最少)', damage: -35, type: 'LOWEST_HP', category: 'HEAL', description: '恢復血量百分比最低的隊友中量生命值', base_trigger_rate: 80, evolution_of: 'heal_single_1', sp_cost: 30, required_level: 8, owner_ids: ['hero_2'], tree_pos: { x: 500, y: 150 } },
      'heal_mid_all': { id: 'heal_mid_all', name: '中級治癒 全體', damage: -25, type: 'ALL_ALLIES', category: 'HEAL', description: '恢復所有隊友中量生命值', base_trigger_rate: 50, sp_cost: 60, required_level: 15, owner_ids: ['hero_2'], tree_pos: { x: 580, y: 250 } },
      'heal_mid_cross': { id: 'heal_mid_cross', name: '中級治癒 十字', damage: -30, type: 'CROSS', category: 'HEAL', description: '恢復十字範圍內的隊友中量生命值', base_trigger_rate: 65, sp_cost: 45, required_level: 12, owner_ids: ['hero_2'], tree_pos: { x: 420, y: 250 } },
      'heal_large_chain': { id: 'heal_large_chain', name: '治癒‧大 連鎖', damage: -50, type: 'CHAIN', category: 'HEAL', description: '透過連鎖恢復多個隊友大量生命值', base_trigger_rate: 60, evolution_of: 'heal_mid_single', sp_cost: 60, required_level: 18, owner_ids: ['hero_2'], tree_pos: { x: 500, y: 250 } },
      'magic_circle': { id: 'magic_circle', name: '神聖魔法陣 範圍+1', damage: -20, type: 'AREA', category: 'HEAL', description: '在地面展開持續恢復的魔法陣', base_trigger_rate: 50, sp_cost: 50, required_level: 12, owner_ids: ['hero_2'], effect: 'regen', tree_pos: { x: 580, y: 150 } },
      'magic_shield_self': { id: 'magic_shield_self', name: '魔法護盾 自己', damage: 0, type: 'SELF', category: 'BUFF', description: '為自己提供一個魔法護盾', base_trigger_rate: 85, sp_cost: 0, required_level: 1, owner_ids: ['hero_2'], effect: 'shield', tree_pos: { x: 420, y: 50 } },

      // --- 巴恩 (hero_3) - 坦克專屬 ---
      'def_up_self': { id: 'def_up_self', name: '防禦力+10% 自己', damage: 0, type: 'SELF', category: 'BUFF', description: '提升自身 10% 防禦力', base_trigger_rate: 90, sp_cost: 0, required_level: 1, owner_ids: ['hero_3'], effect: 'def_up', tree_pos: { x: 350, y: 50 } },
      'def_up_self_1t': { id: 'def_up_self_1t', name: '防禦力+10% 自己 1回合', damage: 0, type: 'SELF', category: 'BUFF', description: '本回合大幅提升自身防禦力', base_trigger_rate: 95, sp_cost: 20, required_level: 1, owner_ids: ['hero_3'], effect: 'def_up', duration: 1, tree_pos: { x: 420, y: 50 } },
      'shield_bash': { id: 'shield_bash', name: '盾牌猛擊 單體', damage: 15, type: 'SINGLE', category: 'PHYSICAL', description: '用盾牌撞擊敵人，有機率造成暈眩', base_trigger_rate: 60, sp_cost: 25, required_level: 5, owner_ids: ['hero_3'], effect: 'stun', tree_pos: { x: 350, y: 150 } },
      'heavy_strike_pincer': { id: 'heavy_strike_pincer', name: '重擊 受夾擊目標', damage: 22, type: 'PINCER_ONLY', category: 'PHYSICAL', description: '對受夾擊的目標發動重擊', base_trigger_rate: 85, sp_cost: 0, required_level: 1, owner_ids: ['hero_3'], tree_pos: { x: 280, y: 50 } },
      'heal_self_small': { id: 'heal_self_small', name: '治療‧小 自己', damage: -10, type: 'SELF', category: 'HEAL', description: '恢復自身少量生命值', base_trigger_rate: 80, sp_cost: 0, required_level: 1, owner_ids: ['hero_3'], tree_pos: { x: 280, y: 150 } },
      'taunt_all': { id: 'taunt_all', name: '嘲諷 全體', damage: 0, type: 'ALL_ENEMIES', category: 'BUFF', description: '吸引所有敵人的注意力', base_trigger_rate: 70, sp_cost: 40, required_level: 5, owner_ids: ['hero_3'], effect: 'taunt', tree_pos: { x: 420, y: 150 } },
      'iron_will': { id: 'iron_will', name: '鋼鐵意志 自己', damage: 0, type: 'SELF', category: 'BUFF', description: '大幅提升防禦力並獲得護盾', base_trigger_rate: 40, sp_cost: 70, required_level: 20, owner_ids: ['hero_3'], effect: 'shield', tree_pos: { x: 350, y: 250 } },

      // --- 希露菲 (hero_4) - 弓手專屬 ---
      'arrow_rain_1': { id: 'arrow_rain_1', name: '箭雨 橫1列', damage: 12, type: 'ROW_1', category: 'PHYSICAL', description: '召喚箭雨攻擊橫向 1 列', base_trigger_rate: 85, sp_cost: 0, required_level: 1, owner_ids: ['hero_4'], tree_pos: { x: 200, y: 50 } },
      'arrow_rain_2': { id: 'arrow_rain_2', name: '箭雨 橫3列', damage: 22, type: 'ROW_3', category: 'PHYSICAL', description: '召喚更密集的箭雨攻擊橫向 3 列', base_trigger_rate: 65, evolution_of: 'arrow_rain_1', sp_cost: 30, required_level: 10, owner_ids: ['hero_4'], tree_pos: { x: 200, y: 150 } },
      'poison_arrow': { id: 'poison_arrow', name: '劇毒之箭 單體', damage: 15, type: 'SINGLE', category: 'PHYSICAL', description: '射出帶有劇毒的箭矢', base_trigger_rate: 70, sp_cost: 40, required_level: 15, owner_ids: ['hero_4'], effect: 'poison', tree_pos: { x: 280, y: 150 } },
      'double_shot_pincer': { id: 'double_shot_pincer', name: '二連射 受夾擊目標', damage: 20, type: 'PINCER_ONLY', category: 'PHYSICAL', description: '對受夾擊目標快速射出兩箭', base_trigger_rate: 80, sp_cost: 0, required_level: 1, owner_ids: ['hero_4'], tree_pos: { x: 130, y: 250 } },

      // --- 凱恩 (hero_5) - 魔劍士專屬 ---
      'meteor_small': { id: 'meteor_small', name: '小型隕石 範圍+1', damage: 25, type: 'AREA', category: 'MAGIC', description: '召喚小型隕石轟擊區域', base_trigger_rate: 60, sp_cost: 0, required_level: 1, owner_ids: ['hero_5'], tree_pos: { x: 650, y: 50 } },
      'meteor_mid': { id: 'meteor_mid', name: '中型隕石 範圍+2', damage: 45, type: 'AROUND_2', category: 'MAGIC', description: '召喚中型隕石造成大範圍傷害', base_trigger_rate: 50, evolution_of: 'meteor_small', sp_cost: 40, required_level: 10, owner_ids: ['hero_5'], tree_pos: { x: 650, y: 150 } },
      'meteor_large': { id: 'meteor_large', name: '終焉隕石 全體', damage: 80, type: 'ALL_ENEMIES', category: 'MAGIC', description: '召喚巨大的隕石毀滅一切', base_trigger_rate: 30, evolution_of: 'meteor_mid', sp_cost: 100, required_level: 25, owner_ids: ['hero_5'], tree_pos: { x: 650, y: 250 } },
      'mana_burst_pincer': { id: 'mana_burst_pincer', name: '魔力爆發 受夾擊目標', damage: 28, type: 'PINCER_ONLY', category: 'MAGIC', description: '在受夾擊目標處引爆魔力', base_trigger_rate: 75, sp_cost: 0, required_level: 1, owner_ids: ['hero_5'], tree_pos: { x: 730, y: 50 } },

      // --- 莫妮卡 (hero_6) - 舞者專屬 ---
      'inspire_dance': { id: 'inspire_dance', name: '鼓舞之舞 範圍+1', damage: 0, type: 'AREA', category: 'BUFF', description: '跳起鼓舞人心的舞蹈，提升隊友攻擊力', base_trigger_rate: 70, sp_cost: 0, required_level: 1, owner_ids: ['hero_6'], effect: 'atk_up', tree_pos: { x: 800, y: 50 } },
      'phantom_arrow': { id: 'phantom_arrow', name: '幻影箭 單體', damage: 20, type: 'SINGLE', category: 'PHYSICAL', description: '射出難以捉摸的幻影箭', base_trigger_rate: 60, sp_cost: 30, required_level: 8, owner_ids: ['hero_6'], tree_pos: { x: 800, y: 150 } },
      'step_dance_pincer': { id: 'step_dance_pincer', name: '步法之舞 受夾擊目標', damage: 16, type: 'PINCER_ONLY', category: 'PHYSICAL', description: '優雅地攻擊受夾擊的目標', base_trigger_rate: 85, sp_cost: 0, required_level: 1, owner_ids: ['hero_6'], tree_pos: { x: 880, y: 50 } },

      // --- 共享技能 (2成比例) ---
      'group_shield': { id: 'group_shield', name: '守護之光 範圍+1', damage: 0, type: 'AREA', category: 'BUFF', description: '為範圍內的隊友提供護盾', base_trigger_rate: 60, sp_cost: 70, required_level: 20, owner_ids: ['hero_2', 'hero_3'], effect: 'shield', tree_pos: { x: 420, y: 250 } },
      'atk_up_shared': { id: 'atk_up_shared', name: '戰意激發 自己', damage: 0, type: 'SELF', category: 'BUFF', description: '提升自身 15% 攻擊力', base_trigger_rate: 80, sp_cost: 30, required_level: 12, owner_ids: ['hero_1', 'hero_4', 'hero_5', 'hero_6'], effect: 'atk_up', tree_pos: { x: 130, y: 250 } },
      'def_up_shared': { id: 'def_up_shared', name: '堅毅防禦 自己', damage: 0, type: 'SELF', category: 'BUFF', description: '提升自身 15% 防禦力', base_trigger_rate: 80, sp_cost: 30, required_level: 12, owner_ids: ['hero_2', 'hero_3'], effect: 'def_up', tree_pos: { x: 420, y: 150 } },

      // --- Advanced Skills (Job Advancement) ---
      // Paladin / Blademaster
      'holy_strike': { id: 'holy_strike', name: '神聖打擊 十字', damage: 50, type: 'CROSS', category: 'PHYSICAL', description: '對十字範圍造成神聖傷害並恢復少量生命', base_trigger_rate: 50, sp_cost: 80, required_level: 15, owner_ids: ['hero_1'], effect: 'regen', tree_pos: { x: 50, y: 350 } },
      'omni_slash': { id: 'omni_slash', name: '無盡斬擊 全體', damage: 60, type: 'ALL_ENEMIES', category: 'PHYSICAL', description: '對所有敵人發動毀滅性的斬擊', base_trigger_rate: 35, sp_cost: 120, required_level: 20, owner_ids: ['hero_1'], tree_pos: { x: 130, y: 350 } },
      
      // Saint / Bard
      'resurrection_light': { id: 'resurrection_light', name: '復活之光 全體', damage: -60, type: 'ALL_ALLIES', category: 'HEAL', description: '大幅恢復所有隊友生命值並提供強力護盾', base_trigger_rate: 40, sp_cost: 100, required_level: 20, owner_ids: ['hero_2'], effect: 'shield', tree_pos: { x: 500, y: 350 } },
      'heavenly_hymn': { id: 'heavenly_hymn', name: '天堂讚歌 範圍+2', damage: 0, type: 'AROUND_2', category: 'BUFF', description: '大幅提升範圍內隊友的所有能力', base_trigger_rate: 60, sp_cost: 90, required_level: 15, owner_ids: ['hero_2'], effect: 'atk_up', duration: 5, tree_pos: { x: 580, y: 350 } },

      // Guardian / Berserker
      'unbreakable_wall': { id: 'unbreakable_wall', name: '不破之牆 全體隊友', damage: 0, type: 'ALL_ALLIES', category: 'BUFF', description: '為所有隊友提供巨額護盾', base_trigger_rate: 50, sp_cost: 110, required_level: 20, owner_ids: ['hero_3'], effect: 'shield', tree_pos: { x: 350, y: 350 } },
      'blood_fury': { id: 'blood_fury', name: '血色狂暴 自己', damage: 0, type: 'SELF', category: 'BUFF', description: '極大提升攻擊力但降低防禦力', base_trigger_rate: 80, sp_cost: 50, required_level: 15, owner_ids: ['hero_3'], effect: 'atk_up', duration: 3, tree_pos: { x: 280, y: 250 } },

      // Sniper / Assassin
      'god_slayer_shot': { id: 'god_slayer_shot', name: '弒神之箭 單體', damage: 120, type: 'SINGLE', category: 'PHYSICAL', description: '對單體目標造成極致傷害', base_trigger_rate: 30, sp_cost: 150, required_level: 25, owner_ids: ['hero_4'], tree_pos: { x: 200, y: 250 } },
      'shadow_raid': { id: 'shadow_raid', name: '暗影突襲 十字', damage: 45, type: 'CROSS', category: 'PHYSICAL', description: '從陰影中發動攻擊，有機率造成眩暈', base_trigger_rate: 55, sp_cost: 70, required_level: 15, owner_ids: ['hero_4'], effect: 'stun', tree_pos: { x: 280, y: 250 } },

      // Archmage
      'apocalypse': { id: 'apocalypse', name: '末日審判 全體', damage: 150, type: 'ALL_ENEMIES', category: 'MAGIC', description: '召喚末日之火焚燒所有敵人', base_trigger_rate: 20, sp_cost: 200, required_level: 30, owner_ids: ['hero_5'], effect: 'burn', tree_pos: { x: 730, y: 250 } },

      // --- Monster Skills ---
      'bite': { id: 'bite', name: '撕咬', damage: 10, type: 'SELF', category: 'PHYSICAL', description: '對自身周圍的敵人造成物理傷害', base_trigger_rate: 100 },
      'boss_smash': { id: 'boss_smash', name: '巨力重擊', damage: 30, type: 'AREA', category: 'PHYSICAL', description: '對大範圍內的敵人造成毀滅性打擊', base_trigger_rate: 100, effect: 'stun' }
    },
    skill_combos: SKILL_COMBOS
  },
  memory_fragments: ["準備開始冒險..."],
  pending_buffer: null,
  current_path: [],
  combat_log: [{ id: 'initial-log', text: "歡迎來到第 1 層。探索地圖以尋找出口或戰鬥。" }],
  damage_numbers: [],
  level_up_animations: [],
  active_skill_animation: null,
  active_dialogue: null,
  battle_monsters: [],
  last_dialogue_npc_id: null,
  is_game_over: false
};

// --- Reducer ---
type Action =
  | { type: 'SET_USER'; payload: GameState['user'] }
  | { type: 'SET_ALL_CHARACTERS'; payload: Entity[] }
  | { type: 'SET_BACKPACK'; payload: Item[] }
  | { type: 'UPDATE_CHARACTER'; payload: Entity }
  | { type: 'MOVE_ENTITY'; payload: { id: string; x: number; y: number } }
  | { type: 'SWAP_ENTITIES'; payload: { activeId: string; targetId: string; activeX: number; activeY: number; targetX: number; targetY: number } }
  | { type: 'SET_PATH'; payload: { x: number; y: number }[] }
  | { type: 'SET_MODE'; payload: GameMode }
  | { type: 'TRIGGER_BATTLE'; payload: { encounterId: string, battle_config?: any } }
  | { type: 'DAMAGE_ENTITY'; payload: { id: string; damage: number } }
  | { type: 'CLEAR_DAMAGE_NUMBER'; payload: string }
  | { type: 'ADD_LEVEL_UP_ANIMATION'; payload: LevelUpAnimation }
  | { type: 'CLEAR_LEVEL_UP_ANIMATION'; payload: string }
  | { type: 'LOG_MESSAGE'; payload: string }
  | { type: 'REMOVE_TEAM_MEMBER'; payload: string }
  | { type: 'SET_SKILL_ANIMATION'; payload: { attacker_id: string; skill_id: string; affected_tiles: { x: number; y: number }[] } | null }
  | { type: 'START_DIALOGUE'; payload: Entity }
  | { type: 'UPDATE_DIALOGUE'; payload: { role: 'npc' | 'player'; content: string } }
  | { type: 'SET_DIALOGUE_LOADING'; payload: boolean }
  | { type: 'END_DIALOGUE' }
  | { type: 'REMOVE_ENTITY'; payload: string }
  | { type: 'REMOVE_DEAD' }
  | { type: 'UPDATE_ENTITY_MEMORY'; payload: { id: string; memory: string } }
  | { type: 'SET_MAP_AND_STAGE'; payload: { stage: number; map_data: MapData; new_monsters: Entity[] } }
  | { type: 'SET_STAGE'; payload: number }
  | { type: 'NEXT_STAGE' }
  | { type: 'ADD_TEAM_MEMBER'; payload: Entity }
  | { type: 'SET_TEAM'; payload: Entity[] }
  | { type: 'KICK_CHARACTER'; payload: string }
  | { type: 'ADD_SKILLS_TO_REGISTRY'; payload: Record<string, Skill> }
  | { type: 'EQUIP_SKILL'; payload: { entityId: string; skillId: string; slotIndex: number } }
  | { type: 'LEARN_SKILL'; payload: { entityId: string; skillId: string; spCost: number } }
  | { type: 'GAIN_SP'; payload: { entityId: string; amount: number } }
  | { type: 'GAIN_EXP'; payload: { entityId: string; amount: number } }
  | { type: 'LEVEL_UP'; payload: { entityId: string } }
  | { type: 'ADD_INVENTORY_ITEM'; payload: Item }
  | { type: 'USE_ITEM'; payload: { itemId: string; targetId: string } }
  | { type: 'DISCARD_ITEM'; payload: string }
  | { type: 'OPEN_CHEST'; payload: string }
  | { type: 'JOB_ADVANCE'; payload: { entityId: string; newJob: JobType } }
  | { type: 'REMOVE_ENTITY_FROM_MAP'; payload: string }
  | { type: 'ADD_STATUS_EFFECT'; payload: { entityId: string; effect: StatusEffect } }
  | { type: 'TICK_STATUS_EFFECTS' }
  | { type: 'CLEAR_BATTLE_BUFFS' }
  | { type: 'RESET_STAGE' }
  | { type: 'GAME_OVER' }
  | { type: 'RESET_LAST_NPC' }
  | { type: 'FIX_STUCK' };

function gameReducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_ALL_CHARACTERS':
      return {
        ...state,
        player_state: {
          ...state.player_state,
          all_characters: action.payload.map(newChar => {
            const existing = state.player_state.all_characters.find(c => c.id === newChar.id);
            if (existing) {
              return { ...newChar, x: existing.x, y: existing.y };
            }
            // If not in state, it's a fresh load, use (1,1) or default
            return { ...newChar, x: 1, y: 1 };
          })
        }
      };
    case 'SET_BACKPACK':
      return {
        ...state,
        player_state: {
          ...state.player_state,
          backpack: action.payload
        }
      };
    case 'UPDATE_CHARACTER': {
      const updatedChar = action.payload;
      const update = (entities: Entity[]) => entities.map(e => e.id === updatedChar.id ? { ...e, ...updatedChar } : e);
      return {
        ...state,
        player_state: {
          ...state.player_state,
          all_characters: update(state.player_state.all_characters),
          team: update(state.player_state.team)
        }
      };
    }
    case 'SET_TEAM':
      return {
        ...state,
        player_state: {
          ...state.player_state,
          team: ensureUniqueEntities(action.payload.map((newChar, idx) => {
            const existing = state.player_state.team.find(c => c.id === newChar.id);
            if (existing) {
              return { ...newChar, x: existing.x, y: existing.y };
            }
            // If not in state, it's a fresh load, use (1,1) or default
            return { ...newChar, x: 1, y: 1 + idx };
          }))
        }
      };
    case 'REMOVE_TEAM_MEMBER':
      return {
        ...state,
        player_state: {
          ...state.player_state,
          team: state.player_state.team.filter(m => m.id !== action.payload)
        }
      };
    case 'KICK_CHARACTER':
      return {
        ...state,
        player_state: {
          ...state.player_state,
          team: state.player_state.team.filter(m => m.id !== action.payload),
          all_characters: state.player_state.all_characters.filter(m => m.id !== action.payload)
        }
      };
    case 'ADD_SKILLS_TO_REGISTRY':
      return {
        ...state,
        world_state: {
          ...state.world_state,
          skills_registry: {
            ...state.world_state.skills_registry,
            ...action.payload
          }
        }
      };
    case 'ADD_TEAM_MEMBER': {
      const isAlreadyInAllCharacters = state.player_state.all_characters.some(p => p.id === action.payload.id);
      
      // Prevent recruiting the same NPC multiple times (check by name only for NEW recruits)
      if (!isAlreadyInAllCharacters && state.player_state.all_characters.some(p => p.name === action.payload.name)) {
        return state;
      }

      // If already in team, do nothing
      if (state.player_state.team.some(p => p.id === action.payload.id)) return state;

      const newChar = isAlreadyInAllCharacters 
        ? state.player_state.all_characters.find(p => p.id === action.payload.id)!
        : {
            ...action.payload,
            type: 'player',
            hp: Math.max(1, action.payload.hp), // Ensure they are alive when joining
            sp: action.payload.sp || 0,
            exp: action.payload.exp || 0,
            level: action.payload.level || 1,
            sb: action.payload.sb || 0,
            equipped_skills: action.payload.equipped_skills || [action.payload.skills[0]],
            unlocked_combos: checkUnlockedCombos(action.payload.skills)
          };

      // Use the current available slots based on stage
      const availableSlots = state.stage === 1 ? 3 : (state.stage < 4 ? 4 : (state.stage < 6 ? 5 : 6));
      const teamIsFull = state.player_state.team.length >= availableSlots;
      
      let newTeam = [...state.player_state.team];

      if (!teamIsFull) {
        // Find a safe position near the leader instead of exactly on top of them
        const leader = state.player_state.team[0];
        let spawnX = 1;
        let spawnY = 1;
        
        if (leader) {
          const neighbors = [[0,1], [0,-1], [1,0], [-1,0], [1,1], [1,-1], [-1,1], [-1,-1]];
          for (const [dx, dy] of neighbors) {
            const nx = leader.x + dx;
            const ny = leader.y + dy;
            const isOccupied = state.player_state.team.some(p => p.x === nx && p.y === ny) || 
                              state.world_state.entities_on_map.some(e => e.x === nx && e.y === ny);
            const terrain = state.world_state.map_data.grid[ny]?.[nx];
            const isPassable = terrain === 0 || terrain === 4;
            const objectId = state.world_state.map_data.objectGrid?.[ny]?.[nx];
            const isObjectSolid = objectId !== null && isSolidObject(objectId || 0);

            if (!isOccupied && isPassable && !isObjectSolid) {
              spawnX = nx;
              spawnY = ny;
              break;
            }
          }
        }
        newChar.x = spawnX;
        newChar.y = spawnY;
        newTeam.push(newChar as Entity);
      } else if (!isAlreadyInAllCharacters) {
        newChar.x = 1;
        newChar.y = 1;
      }

      return {
        ...state,
        player_state: {
          ...state.player_state,
          all_characters: isAlreadyInAllCharacters 
            ? state.player_state.all_characters 
            : [...state.player_state.all_characters, newChar as Entity],
          team: ensureUniqueEntities(newTeam)
        }
      };
    }
    case 'SET_STAGE':
      return { ...state, stage: action.payload };
    case 'SET_MAP_AND_STAGE': {
      const { stage, map_data, new_monsters } = action.payload;
      const safePositions = findSafePositions(map_data.grid, state.player_state.team.length, map_data.objectGrid);
      
      return {
        ...state,
        stage,
        game_mode: 'EXPLORATION',
        world_state: {
          ...state.world_state,
          map_data,
          entities_on_map: ensureUniqueEntities(new_monsters),
        },
        combat_log: [{ id: generateId('stage-entry-'), text: `--- 進入第 ${stage} 層 ---` }, ...state.combat_log].slice(0, 10),
        player_state: {
          ...state.player_state,
          team: ensureUniqueEntities(state.player_state.team.map((p, idx) => ({ 
            ...p, 
            x: safePositions[idx]?.x ?? 1, 
            y: safePositions[idx]?.y ?? (1 + idx) 
          })))
        }
      };
    }
    case 'NEXT_STAGE': {
      const nextStage = state.stage + 1;
      const isBossStage = nextStage % 3 === 0;
      
      // Unlock more team slots
      let newTeamSlots = state.player_state.team_slots;
      if (state.stage === 1) {
        newTeamSlots = 4;
        state.combat_log = [{ id: generateId('slot-unlock-'), text: "完成第一關！解鎖第 4 個隊伍位置。再過 2 層解鎖下一個位置。" }, ...state.combat_log];
      } else if (state.stage === 3) {
        newTeamSlots = 5;
        state.combat_log = [{ id: generateId('slot-unlock-'), text: "完成第三關！解鎖第 5 個隊伍位置。再過 2 層解鎖最後一個位置。" }, ...state.combat_log];
      } else if (state.stage === 5) {
        newTeamSlots = 6;
        state.combat_log = [{ id: generateId('slot-unlock-'), text: "解鎖最終隊伍位置（6人）！" }, ...state.combat_log];
      } else {
        const layersToNext = 2 - (state.stage % 2);
        if (state.stage < 5) {
          state.combat_log = [{ id: generateId('slot-info-'), text: `距離下一個隊伍欄位解鎖還有 ${layersToNext} 層。` }, ...state.combat_log];
        }
      }

      const safePositions = findSafePositions(state.world_state.map_data.grid, state.player_state.team.length, state.world_state.map_data.objectGrid);
      
      // Helper to find spawn positions away from players
      const findSpawnPos = (count: number, minDistance: number = 4) => {
        const spawnPos: {x: number, y: number}[] = [];
        const { width, height, grid, objectGrid } = state.world_state.map_data;
        
        let attempts = 0;
        while (spawnPos.length < count && attempts < 100) {
          attempts++;
          const rx = 1 + Math.floor(Math.random() * (width - 2));
          const ry = 1 + Math.floor(Math.random() * (height - 2));
          
          // Check terrain
          const terrain = grid[ry][rx];
          if (terrain !== 0 && terrain !== 4) continue;
          
          // Check objects
          const objectId = objectGrid ? objectGrid[ry][rx] : null;
          if (objectId !== null && isSolidObject(objectId)) continue;
          
          // Check distance from all player safe positions
          const tooClose = safePositions.some(p => Math.abs(p.x - rx) + Math.abs(p.y - ry) < minDistance);
          if (tooClose) continue;
          
          // Check distance from other spawned monsters
          const tooCloseToOthers = spawnPos.some(p => Math.abs(p.x - rx) + Math.abs(p.y - ry) < 2);
          if (tooCloseToOthers) continue;
          
          spawnPos.push({ x: rx, y: ry });
        }
        
        // Fallback if we can't find enough "safe" spots
        while (spawnPos.length < count) {
          spawnPos.push({ x: width - 2, y: height - 2 - spawnPos.length });
        }
        
        return spawnPos;
      };

      const newMonsters: Entity[] = [];
      const monsterCount = isBossStage ? 1 : 3 + Math.floor(nextStage / 2);
      const spawnNPC = Math.random() > 0.5 && !isBossStage;
      const totalToSpawn = monsterCount + (spawnNPC ? 1 : 0);
      const spawnPositions = findSpawnPos(totalToSpawn);

      if (isBossStage) {
        newMonsters.push({
          id: generateId('boss_'),
          name: '巨型哥布林王',
          avatar: '👹',
          type: 'monster',
          class_type: 'MELEE',
          job_type: JobType.MONSTER,
          x: spawnPositions[0].x,
          y: spawnPositions[0].y,
          hp: 500 + nextStage * 100,
          max_hp: 500 + nextStage * 100,
          atk: 40 + nextStage * 5,
          def: 20 + nextStage * 2,
          skills: ['boss_smash', 'bite'],
          equipped_skills: ['boss_smash', 'bite'],
          sp: 50,
          exp: 200,
          level: nextStage,
          sb: 5,
          size: 2,
          shield: 0
        });
      } else {
        for (let i = 0; i < monsterCount; i++) {
          newMonsters.push({
            id: generateId('monster_'),
            name: nextStage > 3 ? '高級哥布林' : '哥布林',
            avatar: nextStage > 3 ? '👺' : '👾',
            type: 'monster',
            class_type: 'MELEE',
            job_type: JobType.MONSTER,
            x: spawnPositions[i].x,
            y: spawnPositions[i].y,
            hp: 60 + nextStage * 20,
            max_hp: 60 + nextStage * 20,
            atk: 15 + nextStage * 3,
            def: 5 + nextStage * 2,
            skills: ['bite'],
            equipped_skills: ['bite'],
            sp: 5 + Math.floor(nextStage / 2),
            exp: 20 + nextStage * 5,
            level: nextStage,
            sb: 1,
            shield: 0
          });
        }
      }

      // Randomly spawn an NPC
      if (spawnNPC) {
        const npcNames = ['老兵', '旅行商人', '迷路的少女', '神官', '吟遊詩人'];
        const npcAvatars = ['👴', '👳', '👧', '⛪', '🪕'];
        
        const availableNpcs = npcNames.map((name, i) => ({ name, avatar: npcAvatars[i] }))
          .filter(npc => !state.player_state.all_characters.some(c => c.name === npc.name));

        if (availableNpcs.length > 0) {
          const idx = Math.floor(Math.random() * availableNpcs.length);
          const chosenNpc = availableNpcs[idx];
          const pos = spawnPositions[spawnPositions.length - 1];
          newMonsters.push({
            id: generateId(`npc_S${nextStage}_`),
            name: chosenNpc.name,
            avatar: chosenNpc.avatar,
            type: 'npc',
            class_type: 'NONE',
            job_type: JobType.MONSTER,
            x: pos.x,
            y: pos.y,
            hp: 100,
            max_hp: 100,
            atk: 0,
            def: 0,
            skills: [],
            equipped_skills: [],
            sp: 0,
            exp: 0,
            level: 1,
            sb: 0,
            shield: 0
          });
        }
      }

      return {
        ...state,
        stage: nextStage,
        game_mode: 'EXPLORATION',
        world_state: {
          ...state.world_state,
          entities_on_map: ensureUniqueEntities(newMonsters),
        },
        combat_log: [{ id: generateId('stage-entry-'), text: `--- 進入第 ${nextStage} 層 ---` }, ...state.combat_log].slice(0, 10),
        player_state: {
          ...state.player_state,
          team_slots: newTeamSlots,
          team: ensureUniqueEntities(state.player_state.team.map((p, idx) => ({ 
            ...p, 
            x: safePositions[idx]?.x ?? 1, 
            y: safePositions[idx]?.y ?? (1 + idx) 
          }))),
          all_characters: state.player_state.all_characters.map(c => {
            const inTeamIdx = state.player_state.team.findIndex(t => t.id === c.id);
            if (inTeamIdx !== -1) {
              return { 
                ...c, 
                x: safePositions[inTeamIdx]?.x ?? 1, 
                y: safePositions[inTeamIdx]?.y ?? (1 + inTeamIdx) 
              };
            }
            return { ...c, x: 1, y: 1 };
          })
        }
      };
    }
    case 'MOVE_ENTITY':
      const moveInTeam = state.player_state.team.map(m => 
        m.id === action.payload.id ? { ...m, x: action.payload.x, y: action.payload.y } : m
      );
      const moveInAll = state.player_state.all_characters.map(m => 
        m.id === action.payload.id ? { ...m, x: action.payload.x, y: action.payload.y } : m
      );
      const moveOnMap = state.world_state.entities_on_map.map(m => 
        m.id === action.payload.id ? { ...m, x: action.payload.x, y: action.payload.y } : m
      );
      return {
        ...state,
        player_state: {
          ...state.player_state,
          team: ensureUniqueEntities(moveInTeam),
          all_characters: ensureUniqueEntities(moveInAll)
        },
        world_state: {
          ...state.world_state,
          entities_on_map: ensureUniqueEntities(moveOnMap)
        }
      };
    case 'SWAP_ENTITIES': {
      const { activeId, targetId, activeX, activeY, targetX, targetY } = action.payload;
      const swappedTeam = state.player_state.team.map(m => {
        if (m.id === activeId) return { ...m, x: activeX, y: activeY };
        if (m.id === targetId) return { ...m, x: targetX, y: targetY };
        return m;
      });
      const swappedAll = state.player_state.all_characters.map(m => {
        if (m.id === activeId) return { ...m, x: activeX, y: activeY };
        if (m.id === targetId) return { ...m, x: targetX, y: targetY };
        return m;
      });
      return {
        ...state,
        player_state: {
          ...state.player_state,
          team: ensureUniqueEntities(swappedTeam),
          all_characters: ensureUniqueEntities(swappedAll)
        }
      };
    }
    case 'LOG_MESSAGE':
      return { ...state, combat_log: [{ id: generateId('log-'), text: action.payload }, ...state.combat_log].slice(0, 10) };
    case 'UPDATE_ENTITY_MEMORY':
      return {
        ...state,
        world_state: {
          ...state.world_state,
          entities_on_map: state.world_state.entities_on_map.map(e => 
            e.id === action.payload.id 
              ? { ...e, memory: [...(e.memory || []), action.payload.memory] } 
              : e
          )
        }
      };
    case 'REMOVE_DEAD':
      return {
        ...state,
        world_state: {
          ...state.world_state,
          entities_on_map: ensureUniqueEntities(state.world_state.entities_on_map.filter(e => e.hp > 0 || e.type === 'npc' || e.type === 'boss_npc'))
        },
        // Don't filter battle_monsters here, they will be cleared when battle ends or next battle starts
        // This ensures we can calculate EXP at the end of battle
        battle_monsters: state.battle_monsters
      };
    case 'REMOVE_ENTITY':
      return {
        ...state,
        world_state: {
          ...state.world_state,
          entities_on_map: state.world_state.entities_on_map.filter(e => e.id !== action.payload)
        }
      };
    case 'TRIGGER_BATTLE': {
      const { encounterId, battle_config } = action.payload;
      const stage = state.stage;
      
      const BATTLE_GRID_WIDTH = 6;
      const BATTLE_GRID_HEIGHT = 8;

      const newBattleMonsters: Entity[] = [];
      const occupied = new Set<string>();

      if (battle_config?.enemy_entity) {
        // If fighting a specific entity (e.g. NPC or Boss)
        const entity = battle_config.enemy_entity as Entity;
        const tx = 4;
        const ty = 3;
        newBattleMonsters.push({
          ...entity,
          x: tx,
          y: ty,
          hp: entity.max_hp // Ensure full HP for battle
        });
        occupied.add(`${tx},${ty}`);
      } else {
        // Use enemy_count from config if available, otherwise random 6-8
        const monsterCount = battle_config?.enemy_count || (6 + Math.floor(Math.random() * 3));
        
        let placed = 0;
        let attempts = 0;
        while (placed < monsterCount && attempts < 100) {
          attempts++;
          // 50% chance for a cluster (2-3), 50% for isolated (1)
          const isCluster = Math.random() > 0.5;
          const clusterSize = isCluster ? Math.min(2 + Math.floor(Math.random() * 2), monsterCount - placed) : 1;
          
          // Pick a center point
          // Monsters spawn on the right half (x=3 to 5)
          const centerX = 3 + Math.floor(Math.random() * 3);
          const centerY = 1 + Math.floor(Math.random() * 6);
          
          for (let i = 0; i < clusterSize; i++) {
            let tx = centerX;
            let ty = centerY;
            
            if (i > 0) {
              // Offset for cluster members
              const offsets = [[0, 1], [1, 0], [0, -1], [-1, 0]];
              const offset = offsets[i % offsets.length];
              tx += offset[0];
              ty += offset[1];
            }
            
            // Keep within bounds
            tx = Math.min(BATTLE_GRID_WIDTH - 1, Math.max(3, tx));
            ty = Math.min(BATTLE_GRID_HEIGHT - 1, Math.max(0, ty));
            
            if (!occupied.has(`${tx},${ty}`)) {
              const baseHp = 40 + stage * 5;
              const hpMult = battle_config?.enemy_hp_mult || 1.0;
              
              newBattleMonsters.push({
                id: generateId(`battle-monster-S${stage}-`),
                name: battle_config?.enemy_name || '哥布林小隊',
                avatar: battle_config?.enemy_avatar || '👺',
                type: 'monster',
                class_type: 'MELEE',
                job_type: JobType.MONSTER,
                ref_id: 'goblin',
                x: tx,
                y: ty,
                hp: Math.floor(baseHp * hpMult),
                max_hp: Math.floor(baseHp * hpMult),
                atk: 15 + stage * 2,
                def: 5 + stage,
                skills: ['bite'],
                equipped_skills: ['bite'],
                sp: 5 + Math.floor(stage / 2),
                exp: 15 + stage * 2,
                level: stage,
                sb: 2,
                size: 1
              });
              occupied.add(`${tx},${ty}`);
              placed++;
            } else {
              // If spot is occupied, try another spot for this member or break cluster
              if (!isCluster) break;
            }
          }
        }
      }

      // Position players in a formation on the left (x=0 to 2)
      const newTeam = ensureUniqueEntities(state.player_state.team.map((p, idx) => ({
        ...p,
        x: idx % 2,
        y: 2 + Math.floor(idx / 2) * 2
      })));

      return { 
        ...state, 
        game_mode: 'BATTLE', 
        active_battle_id: encounterId,
        current_path: [],
        combat_log: [{ id: generateId('battle-start-'), text: "戰鬥開始！敵人已集結成群。" }],
        battle_monsters: ensureUniqueEntities(newBattleMonsters),
        player_state: {
          ...state.player_state,
          team: newTeam
        }
      };
    }
    case 'DAMAGE_ENTITY': {
      const { id, damage } = action.payload;
      
      const updateEntities = (entities: Entity[]) => 
        entities.map(e => {
          if (e.id !== id) return e;
          
          let remainingDamage = damage;
          let newShield = e.shield || 0;
          let newHp = e.hp;

          if (damage > 0 && newShield > 0) {
            const absorbed = Math.min(newShield, damage);
            newShield -= absorbed;
            remainingDamage -= absorbed;
          }

          if (remainingDamage !== 0) {
            newHp = Math.min(e.max_hp, Math.max(0, e.hp - remainingDamage));
          }

          return { ...e, hp: newHp, shield: newShield };
        });
      
      // Find the entity to get its position for the damage number
      const allEntities = [...state.player_state.team, ...state.world_state.entities_on_map, ...state.battle_monsters];
      const target = allEntities.find(e => e.id === id);
      
      const newDamageNumbers = [...state.damage_numbers];
      if (target && damage !== 0) {
        newDamageNumbers.push({
          id: generateId('dmg-'),
          x: target.x,
          y: target.y,
          amount: Math.abs(damage),
          type: damage > 0 ? 'damage' : 'heal'
        });
      }

      return {
        ...state,
        player_state: { ...state.player_state, team: ensureUniqueEntities(updateEntities(state.player_state.team)) },
        world_state: { ...state.world_state, entities_on_map: ensureUniqueEntities(updateEntities(state.world_state.entities_on_map)) },
        battle_monsters: ensureUniqueEntities(updateEntities(state.battle_monsters)),
        damage_numbers: newDamageNumbers
      };
    }
    case 'CLEAR_DAMAGE_NUMBER':
      return {
        ...state,
        damage_numbers: state.damage_numbers.filter(d => d.id !== action.payload)
      };
    case 'ADD_LEVEL_UP_ANIMATION':
      return {
        ...state,
        level_up_animations: [...state.level_up_animations, action.payload]
      };
    case 'CLEAR_LEVEL_UP_ANIMATION':
      return {
        ...state,
        level_up_animations: state.level_up_animations.filter(a => a.id !== action.payload)
      };
    case 'SET_PATH':
      return { ...state, current_path: action.payload };
    case 'SET_MODE':
      if (state.game_mode === 'BATTLE' && action.payload === 'EXPLORATION') {
        // Reset coordinates to safe positions when leaving battle
        return {
          ...state,
          game_mode: action.payload,
          battle_monsters: [], // Clear battle monsters when leaving battle
          player_state: {
            ...state.player_state,
            team: state.player_state.team.map((p, idx) => ({ ...p, x: 1, y: 1 + idx })),
            all_characters: state.player_state.all_characters.map(c => {
              const inTeamIdx = state.player_state.team.findIndex(t => t.id === c.id);
              if (inTeamIdx !== -1) return { ...c, x: 1, y: 1 + inTeamIdx };
              return { ...c, x: 1, y: 1 };
            })
          }
        };
      }
      return { ...state, game_mode: action.payload };
    case 'REMOVE_TEAM_MEMBER':
      return {
        ...state,
        player_state: {
          ...state.player_state,
          team: state.player_state.team.filter(p => p.id !== action.payload)
        }
      };
    case 'SET_SKILL_ANIMATION':
      return { ...state, active_skill_animation: action.payload };
    case 'RESET_LAST_NPC':
      return { ...state, last_dialogue_npc_id: null };
    case 'START_DIALOGUE':
      if (state.game_mode === 'DIALOGUE' && state.active_dialogue?.npc.id === action.payload.id) return state;
      return { 
        ...state, 
        game_mode: 'DIALOGUE', 
        active_dialogue: { 
          npc: action.payload, 
          messages: [{ role: 'npc', content: `你好，冒險者。我是${action.payload.name}。` }],
          is_loading: false
        },
        last_dialogue_npc_id: action.payload.id
      };
    case 'UPDATE_DIALOGUE':
      if (!state.active_dialogue) return state;
      return {
        ...state,
        active_dialogue: {
          ...state.active_dialogue,
          messages: [...state.active_dialogue.messages, action.payload]
        }
      };
    case 'SET_DIALOGUE_LOADING':
      if (!state.active_dialogue) return state;
      return {
        ...state,
        active_dialogue: {
          ...state.active_dialogue,
          is_loading: action.payload
        }
      };
    case 'END_DIALOGUE':
      return { ...state, game_mode: 'EXPLORATION', active_dialogue: null };

    case 'EQUIP_SKILL': {
      if (state.game_mode === 'BATTLE') return state;
      const { entityId, skillId, slotIndex } = action.payload;
      const update = (entities: Entity[]) => entities.map(m => {
        if (m.id === entityId) {
          const currentEquipped = m.equipped_skills || [];
          // Remove this skill from any other slot first to prevent duplicates
          let newEquipped = currentEquipped.map(s => s === skillId ? null : s);
          // Set to the new slot
          newEquipped[slotIndex] = skillId;
          // Clean up and ensure it's an array of 3 (can have nulls for empty slots)
          const finalEquipped = [null, null, null];
          let fillIdx = 0;
          newEquipped.forEach(s => {
            if (s && fillIdx < 3) {
              finalEquipped[fillIdx] = s;
              fillIdx++;
            }
          });
          return { ...m, equipped_skills: finalEquipped.filter(s => s !== null) as string[] };
        }
        return m;
      });
      return {
        ...state,
        player_state: {
          ...state.player_state,
          all_characters: update(state.player_state.all_characters),
          team: update(state.player_state.team)
        }
      };
    }
    case 'LEARN_SKILL': {
      const { entityId, skillId, spCost } = action.payload;
      const skill = state.world_state.skills_registry[skillId];
      if (!skill) return state;

      const update = (entities: Entity[]) => entities.map(m => {
        if (m.id === entityId) {
          const currentSp = m.sp || 0;
          if (currentSp < spCost) return m;
          
          if (skill.prerequisites) {
            const hasAllPrereqs = skill.prerequisites.every(pId => m.skills.includes(pId));
            if (!hasAllPrereqs) return m;
          }
          
          if (skill.evolution_of && !m.skills.includes(skill.evolution_of)) return m;

          const newSkills = [...m.skills, skillId];
          const newUnlockedCombos = checkUnlockedCombos(newSkills);

          return {
            ...m,
            sp: currentSp - spCost,
            skills: newSkills,
            unlocked_combos: newUnlockedCombos
          };
        }
        return m;
      });

      return {
        ...state,
        player_state: {
          ...state.player_state,
          all_characters: update(state.player_state.all_characters),
          team: update(state.player_state.team)
        }
      };
    }
    case 'GAIN_SP': {
      const { entityId, amount } = action.payload;
      const update = (entities: Entity[]) => entities.map(e => e.id === entityId ? { ...e, sp: (e.sp || 0) + amount } : e);
      return {
        ...state,
        player_state: {
          ...state.player_state,
          all_characters: update(state.player_state.all_characters),
          team: update(state.player_state.team)
        }
      };
    }
    case 'GAIN_EXP': {
      const { entityId, amount } = action.payload;
      let leveledUp = false;
      let finalLevel = 1;
      let targetEntity: Entity | null = null;

      const update = (entities: Entity[]) => entities.map(e => {
        if (e.id === entityId) {
          targetEntity = e;
          let newExp = (e.exp || 0) + amount;
          let newLevel = e.level || 1;
          let newHp = e.hp;
          let newMaxHp = e.max_hp;
          let newAtk = e.atk;
          let newDef = e.def;
          
          while (newExp >= getExpToNextLevel(newLevel)) {
            newExp -= getExpToNextLevel(newLevel);
            newLevel++;
            leveledUp = true;
            // Stat growth
            newMaxHp += 20;
            newHp = newMaxHp;
            newAtk += 5;
            newDef += 3;
          }
          
          finalLevel = newLevel;
          return { 
            ...e, 
            exp: newExp, 
            level: newLevel, 
            hp: newHp, 
            max_hp: newMaxHp, 
            atk: newAtk, 
            def: newDef 
          };
        }
        return e;
      });

      const nextState = {
        ...state,
        player_state: {
          ...state.player_state,
          all_characters: update(state.player_state.all_characters),
          team: update(state.player_state.team)
        }
      };

      if (leveledUp && targetEntity) {
        const entity = targetEntity as Entity;
        nextState.level_up_animations = [
          ...nextState.level_up_animations,
          {
            id: generateId('lvup-'),
            entityId: entity.id,
            x: entity.x,
            y: entity.y,
            name: entity.name,
            level: finalLevel
          }
        ];
        nextState.combat_log = [
          { id: generateId('log-'), text: `🎊 ${entity.name} 等級提升至 ${finalLevel}！` },
          ...nextState.combat_log
        ].slice(0, 10);
      }

      return nextState;
    }
    case 'LEVEL_UP': {
      const { entityId } = action.payload;
      let targetEntity: Entity | null = null;
      let finalLevel = 1;

      const update = (entities: Entity[]) => entities.map(e => {
        if (e.id === entityId) {
          targetEntity = e;
          const newLevel = e.level + 1;
          const newMaxHp = e.max_hp + 20;
          finalLevel = newLevel;
          return { 
            ...e, 
            level: newLevel, 
            max_hp: newMaxHp, 
            hp: newMaxHp,
            atk: e.atk + 5,
            def: e.def + 3,
            exp: 0
          };
        }
        return e;
      });

      const nextState = {
        ...state,
        player_state: {
          ...state.player_state,
          all_characters: update(state.player_state.all_characters),
          team: update(state.player_state.team)
        }
      };

      if (targetEntity) {
        const entity = targetEntity as Entity;
        nextState.level_up_animations = [
          ...nextState.level_up_animations,
          {
            id: generateId('lvup-'),
            entityId: entity.id,
            x: entity.x,
            y: entity.y,
            name: entity.name,
            level: finalLevel
          }
        ];
        nextState.combat_log = [
          { id: generateId('log-'), text: `🎊 ${entity.name} 等級提升至 ${finalLevel}！` },
          ...nextState.combat_log
        ].slice(0, 10);
      }

      return nextState;
    }
    case 'ADD_INVENTORY_ITEM': {
      const existingItemIndex = state.player_state.backpack.findIndex(
        i => i.name === action.payload.name && i.type === action.payload.type
      );
      
      let newBackpack = [...state.player_state.backpack];
      if (existingItemIndex >= 0) {
        newBackpack[existingItemIndex] = {
          ...newBackpack[existingItemIndex],
          quantity: (newBackpack[existingItemIndex].quantity || 1) + (action.payload.quantity || 1)
        };
      } else {
        newBackpack.push({ ...action.payload, quantity: action.payload.quantity || 1 });
      }
      
      return {
        ...state,
        player_state: {
          ...state.player_state,
          backpack: newBackpack
        }
      };
    }
    case 'USE_ITEM': {
      const { itemId, targetId } = action.payload;
      const itemIndex = state.player_state.backpack.findIndex(i => i.id === itemId);
      if (itemIndex === -1) return state;
      
      const item = state.player_state.backpack[itemIndex];

      let newTeam = [...state.player_state.team];
      let newAllChars = [...state.player_state.all_characters];
      let newLog = [...state.combat_log];

      const pendingLevelUps: LevelUpAnimation[] = [];

      const updateEntity = (entities: Entity[]) => entities.map(member => {
        if (member.id === targetId) {
          if (item.type === 'HEAL') {
            const healAmount = item.value;
            const newHp = Math.min(member.max_hp, member.hp + healAmount);
            if (entities === state.player_state.team) {
              newLog = [{ id: generateId('item-use-'), text: `${member.name} 使用了 ${item.name}，恢復了 ${newHp - member.hp} 點生命值` }, ...newLog].slice(0, 10);
            }
            return { ...member, hp: newHp };
          } else if (item.type === 'EXP_TOME') {
            const expAmount = item.value;
            newLog = [{ id: generateId('item-use-'), text: `${member.name} 使用了 ${item.name}，獲得了 ${expAmount} 點經驗值` }, ...newLog].slice(0, 10);
            
            let newExp = (member.exp || 0) + expAmount;
            let newLevel = member.level || 1;
            let newHp = member.hp;
            let newMaxHp = member.max_hp;
            let newAtk = member.atk;
            let newDef = member.def;
            let leveledUp = false;
            
            while (newExp >= getExpToNextLevel(newLevel)) {
              newExp -= getExpToNextLevel(newLevel);
              newLevel++;
              leveledUp = true;
              newMaxHp += 20;
              newHp = newMaxHp;
              newAtk += 5;
              newDef += 3;
            }

            if (leveledUp) {
              pendingLevelUps.push({
                id: generateId('lvup-'),
                entityId: member.id,
                x: member.x ?? 5,
                y: member.y ?? 5,
                name: member.name,
                level: newLevel
              });
              newLog = [{ id: generateId('log-'), text: `🎊 ${member.name} 等級提升至 ${newLevel}！` }, ...newLog].slice(0, 10);
            }
            
            return { 
              ...member, 
              exp: newExp, 
              level: newLevel, 
              hp: newHp, 
              max_hp: newMaxHp, 
              atk: newAtk, 
              def: newDef 
            };
          }
        }
        return member;
      });

      newTeam = updateEntity(state.player_state.team);
      newAllChars = updateEntity(state.player_state.all_characters);

      let newBackpack = [...state.player_state.backpack];
      if ((item.quantity || 1) > 1) {
        newBackpack[itemIndex] = {
          ...item,
          quantity: (item.quantity || 1) - 1
        };
      } else {
        newBackpack = newBackpack.filter(i => i.id !== itemId);
      }

      return {
        ...state,
        player_state: {
          ...state.player_state,
          backpack: newBackpack,
          team: newTeam,
          all_characters: newAllChars
        },
        combat_log: newLog,
        level_up_animations: [...state.level_up_animations, ...pendingLevelUps]
      };
    }
    case 'DISCARD_ITEM': {
      return {
        ...state,
        player_state: {
          ...state.player_state,
          backpack: state.player_state.backpack.filter(i => i.id !== action.payload)
        }
      };
    }
    case 'OPEN_CHEST': {
      const chestId = action.payload;
      const chest = state.world_state.entities_on_map.find(e => e.id === chestId);
      if (!chest || chest.type !== 'chest') return state;

      // Generate random loot
      const lootType = Math.random();
      let item: Item;
      
      if (lootType < 0.4) {
        item = {
          id: generateId('item-tome-'),
          name: '初級經驗書',
          description: '增加 50 點經驗值',
          type: 'EXP_TOME',
          value: 50,
          icon: '📖',
          quantity: 1
        };
      } else if (lootType < 0.7) {
        item = {
          id: generateId('item-potion-'),
          name: '生命藥水',
          description: '恢復 50 點生命值',
          type: 'HEAL',
          value: 50,
          icon: '🧪',
          quantity: 1
        };
      } else {
        item = {
          id: generateId('item-tome-'),
          name: '中級經驗書',
          description: '增加 200 點經驗值',
          type: 'EXP_TOME',
          value: 200,
          icon: '📘',
          quantity: 1
        };
      }

      // Check if item already exists to stack
      const existingItemIndex = state.player_state.backpack.findIndex(i => i.name === item.name && i.type === item.type);
      let newBackpack = [...state.player_state.backpack];
      
      if (existingItemIndex >= 0) {
        newBackpack[existingItemIndex] = {
          ...newBackpack[existingItemIndex],
          quantity: (newBackpack[existingItemIndex].quantity || 1) + 1
        };
      } else {
        newBackpack.push(item);
      }

      return {
        ...state,
        world_state: {
          ...state.world_state,
          entities_on_map: state.world_state.entities_on_map.filter(e => e.id !== chestId)
        },
        player_state: {
          ...state.player_state,
          backpack: newBackpack
        },
        combat_log: [{ id: generateId('log-'), text: `🎁 打開寶箱，獲得了 ${item.name}！` }, ...state.combat_log].slice(0, 10)
      };
    }
    case 'JOB_ADVANCE': {
      const { entityId, newJob } = action.payload;
      const update = (entities: Entity[]) => entities.map(m => {
        if (m.id === entityId) {
          return { 
            ...m, 
            job_type: newJob,
            atk: m.atk + 15,
            def: m.def + 10,
            max_hp: m.max_hp + 50,
            hp: m.max_hp + 50,
            sp: (m.sp || 0) + 20 // Bonus SP for advancing
          };
        }
        return m;
      });
      return {
        ...state,
        player_state: {
          ...state.player_state,
          all_characters: update(state.player_state.all_characters),
          team: update(state.player_state.team)
        },
        combat_log: [{ id: generateId('log-'), text: `🎊 轉職成功！恭喜成為 ${newJob}！` }, ...state.combat_log].slice(0, 10)
      };
    }
    case 'REMOVE_ENTITY_FROM_MAP':
      return {
        ...state,
        world_state: {
          ...state.world_state,
          entities_on_map: state.world_state.entities_on_map.filter(e => e.id !== action.payload)
        }
      };
    case 'ADD_STATUS_EFFECT': {
      const { entityId, effect } = action.payload;
      const update = (entities: Entity[]) => entities.map(e => {
        if (e.id === entityId) {
          const effects = e.status_effects || [];
          
          // If it's a shield, update the shield value directly too
          let newShield = e.shield || 0;
          if (effect.effect_type === 'shield') {
            newShield += (effect.value || 0);
          }

          // Replace if same effect_type exists, or add new
          const existingIdx = effects.findIndex(se => se.effect_type === effect.effect_type);
          const newEffects = [...effects];
          if (existingIdx >= 0) {
            newEffects[existingIdx] = effect;
          } else {
            newEffects.push(effect);
          }
          return { ...e, status_effects: newEffects, shield: newShield };
        }
        return e;
      });

      return {
        ...state,
        player_state: { ...state.player_state, team: update(state.player_state.team) },
        world_state: { ...state.world_state, entities_on_map: update(state.world_state.entities_on_map) },
        battle_monsters: update(state.battle_monsters)
      };
    }
    case 'TICK_STATUS_EFFECTS': {
      const tick = (entities: Entity[]) => entities.map(e => {
        if (e.hp <= 0) return { ...e, status_effects: [], shield: 0 }; // Dead entities don't tick
        if (!e.status_effects || e.status_effects.length === 0) return e;
        
        let newHp = e.hp;
        let currentShield = e.shield || 0;
        const newEffects = e.status_effects
          .map(se => ({ ...se, duration: se.duration - 1 }))
          .filter(se => {
            if (se.duration < 0) return false;
            // Apply recurring effects like poison, burn or regen
            if (se.effect_type === 'poison' || se.effect_type === 'burn') {
              // Non-lethal damage from poison/burn (leaves at least 1 HP)
              newHp = Math.max(1, newHp - (se.value || 5));
            }
            if (se.effect_type === 'regen') {
              newHp = Math.min(e.max_hp, newHp + (se.value || 5));
            }
            return true;
          });

        // If no shield effects remain, clear shield value
        if (!newEffects.some(se => se.effect_type === 'shield')) {
          currentShield = 0;
        }

        return { ...e, hp: newHp, status_effects: newEffects, shield: currentShield };
      });

      return {
        ...state,
        player_state: { ...state.player_state, team: tick(state.player_state.team) },
        world_state: { ...state.world_state, entities_on_map: tick(state.world_state.entities_on_map) },
        battle_monsters: tick(state.battle_monsters)
      };
    }
    case 'CLEAR_BATTLE_BUFFS': {
      const clear = (entities: Entity[]) => entities.map(e => ({
        ...e,
        status_effects: [],
        shield: 0
      }));
      return {
        ...state,
        player_state: {
          ...state.player_state,
          team: clear(state.player_state.team),
          all_characters: clear(state.player_state.all_characters)
        }
      };
    }
    case 'RESET_STAGE': {
      // Restore player HP and reset coordinates
      const restoredTeam = state.player_state.team.map((p, idx) => ({ 
        ...p, 
        hp: p.max_hp,
        x: 1,
        y: 1 + idx
      }));
      const restoredAll = state.player_state.all_characters.map(c => {
        const inTeamIdx = state.player_state.team.findIndex(t => t.id === c.id);
        if (inTeamIdx !== -1) return { ...c, x: 1, y: 1 + inTeamIdx };
        return { ...c, x: 1, y: 1 };
      });

      return {
        ...state,
        game_mode: 'EXPLORATION',
        active_battle_id: null,
        is_game_over: false,
        player_state: {
          ...state.player_state,
          team: restoredTeam,
          all_characters: restoredAll
        },
        battle_monsters: [],
        combat_log: [{ id: generateId('reset-'), text: "🔄 關卡重置，生命值與位置已恢復。" }, ...state.combat_log].slice(0, 10)
      };
    }
    case 'GAME_OVER':
      return { ...state, is_game_over: true };
    case 'FIX_STUCK': {
      const resetTeam = state.player_state.team.map((m, idx) => ({
        ...m,
        x: 1,
        y: 1 + idx
      }));
      const resetAll = state.player_state.all_characters.map(m => {
        const inTeam = resetTeam.find(t => t.id === m.id);
        if (inTeam) return inTeam;
        return m;
      });
      return {
        ...state,
        player_state: {
          ...state.player_state,
          team: resetTeam,
          all_characters: resetAll
        }
      };
    }
    default:
      return state;
  }
}

// --- Context Provider ---
export const GameContext = createContext<{
  state: GameState;
  dispatch: React.Dispatch<Action>;
}>({ state: initialState, dispatch: () => null });

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
};
