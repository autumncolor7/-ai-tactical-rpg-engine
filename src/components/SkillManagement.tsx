import React, { useContext, useState } from 'react';
import { GameContext, Skill, Entity, calculateTriggerRate } from '../context/GameContext';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, Lock, Zap, Info, CheckCircle2 } from 'lucide-react';

interface SkillManagementProps {
  entity: Entity;
  onLearn: (skill: Skill) => void;
  onEquip: (skillId: string, slotIndex: number) => void;
}

export default function SkillManagement({ entity, onLearn, onEquip }: SkillManagementProps) {
  const { state } = useContext(GameContext);
  const skillsRegistry = state.world_state.skills_registry;
  const [selectedSlot, setSelectedSlot] = useState<number>(0);
  const [hoveredSkill, setHoveredSkill] = useState<Skill | null>(null);

  // Filter skills relevant to this character
  const allSkills = (Object.values(skillsRegistry) as Skill[]).filter(s => 
    s.tree_pos && s.owner_ids?.includes(entity.id)
  );
  
  const learnedSkills = allSkills.filter(s => entity.skills.includes(s.id));
  const unlearnedSkills = allSkills.filter(s => !entity.skills.includes(s.id));

  const isEquipped = (skillId: string) => entity.equipped_skills.includes(skillId);
  
  const canLearn = (skill: Skill) => {
    if (entity.skills.includes(skill.id)) return false;
    if ((entity.sp || 0) < (skill.sp_cost || 0)) return false;
    if ((entity.level || 1) < (skill.required_level || 1)) return false;
    
    if (skill.evolution_of && !entity.skills.includes(skill.evolution_of)) return false;
    if (skill.prerequisites && !skill.prerequisites.every(pId => entity.skills.includes(pId))) return false;
    
    return true;
  };

  const getLockReason = (skill: Skill) => {
    if ((entity.level || 1) < (skill.required_level || 1)) return `等級 ${skill.required_level} 解鎖`;
    if (skill.evolution_of && !entity.skills.includes(skill.evolution_of)) return `需先習得 ${skillsRegistry[skill.evolution_of]?.name}`;
    if (skill.prerequisites) {
      const missing = skill.prerequisites.find(pId => !entity.skills.includes(pId));
      if (missing) return `需先習得 ${skillsRegistry[missing]?.name}`;
    }
    if ((entity.sp || 0) < (skill.sp_cost || 0)) return `SP 不足 (${skill.sp_cost})`;
    return null;
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Top Section: Equipped Slots */}
      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
            <Zap className="w-4 h-4 text-yellow-500" /> 已裝備技能
          </h3>
          <span className="text-[10px] text-white/40">點擊插槽選擇要更換的位置</span>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((idx) => {
            const skillId = entity.equipped_skills[idx];
            const skill = skillId ? skillsRegistry[skillId] : null;
            const isActive = selectedSlot === idx;

            return (
              <motion.div
                key={idx}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedSlot(idx)}
                className={`relative h-24 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                  isActive 
                    ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_20px_rgba(234,179,8,0.2)]' 
                    : 'border-white/10 bg-white/5 hover:border-white/20'
                }`}
              >
                <div className="absolute top-2 left-2 text-[10px] font-bold text-white/20">
                  SLOT {idx + 1}
                </div>
                
                {skill ? (
                  <>
                    <span className="text-xs font-bold text-yellow-500 text-center px-2">{skill.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/40">{skill.type}</span>
                      <span className="text-[10px] text-red-400">ATK {Math.abs(skill.damage)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 opacity-20">
                    <div className="w-8 h-8 rounded-full border border-dashed border-white flex items-center justify-center">
                      <Zap className="w-4 h-4" />
                    </div>
                    <span className="text-[10px]">未裝備</span>
                  </div>
                )}

                {isActive && (
                  <motion.div 
                    layoutId="active-indicator"
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-yellow-500 rotate-45"
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Bottom Section: Skill Pool */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-400" /> 技能池
          </h3>
          <div className="flex gap-4 text-[10px]">
            <span className="flex items-center gap-1 text-yellow-500"><CheckCircle2 className="w-3 h-3" /> 已習得</span>
            <span className="flex items-center gap-1 text-blue-400"><Zap className="w-3 h-3" /> 可學習</span>
            <span className="flex items-center gap-1 text-white/20"><Lock className="w-3 h-3" /> 未解鎖</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          <div className="grid grid-cols-1 gap-2">
            {allSkills.map(skill => {
              const learned = entity.skills.includes(skill.id);
              const equipped = isEquipped(skill.id);
              const available = canLearn(skill);
              const lockReason = getLockReason(skill);

              return (
                <motion.div
                  key={skill.id}
                  onMouseEnter={() => setHoveredSkill(skill)}
                  onMouseLeave={() => setHoveredSkill(null)}
                  onClick={() => {
                    if (learned) onEquip(skill.id, selectedSlot);
                    else if (available) onLearn(skill);
                  }}
                  className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-4 ${
                    learned 
                      ? (equipped ? 'bg-yellow-500/10 border-yellow-500/50' : 'bg-zinc-800/50 border-white/5 hover:border-yellow-500/30')
                      : (available ? 'bg-blue-900/10 border-blue-500/30 hover:border-blue-500' : 'bg-black/40 border-white/5 opacity-50 grayscale')
                  }`}
                >
                  {/* Status Icon */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    learned ? 'bg-yellow-500/20 text-yellow-500' : (available ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-white/20')
                  }`}>
                    {learned ? <CheckCircle2 className="w-5 h-5" /> : (available ? <Zap className="w-5 h-5" /> : <Lock className="w-5 h-5" />)}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-sm font-bold ${learned ? 'text-yellow-500' : (available ? 'text-blue-400' : 'text-white/40')}`}>
                        {skill.name}
                      </span>
                      {equipped && (
                        <span className="text-[8px] bg-yellow-500 text-black px-1 rounded font-bold">EQUIPPED</span>
                      )}
                    </div>
                    <p className="text-[10px] text-white/40 line-clamp-1">{skill.description}</p>
                  </div>

                  {/* Requirements/Cost */}
                  <div className="text-right">
                    {!learned ? (
                      <div className="flex flex-col items-end">
                        {lockReason ? (
                          <span className="text-[10px] text-red-400/80 font-medium">{lockReason}</span>
                        ) : (
                          <>
                            <span className="text-xs font-bold text-blue-400">{skill.sp_cost} SP</span>
                            <span className="text-[9px] text-white/20">點擊學習</span>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-white/40">{skill.type}</span>
                        <span className="text-[10px] text-yellow-500/60 font-medium">
                          發動率: {Math.round(calculateTriggerRate(entity, skill))}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Hover Detail Overlay */}
                  <AnimatePresence>
                    {hoveredSkill?.id === skill.id && (
                      <motion.div
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="absolute left-full ml-4 top-0 w-48 p-3 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 pointer-events-none"
                      >
                        <p className="text-xs font-bold text-yellow-500 mb-1">{skill.name}</p>
                        <p className="text-[10px] text-white/70 mb-2 leading-relaxed">{skill.description}</p>
                        <div className="grid grid-cols-2 gap-2 text-[9px] pt-2 border-t border-white/5">
                          <div>
                            <span className="text-white/40 block">威力</span>
                            <span className="text-red-400 font-bold">{Math.abs(skill.damage)}</span>
                          </div>
                          <div>
                            <span className="text-white/40 block">類型</span>
                            <span className="text-blue-400 font-bold">{skill.type}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
