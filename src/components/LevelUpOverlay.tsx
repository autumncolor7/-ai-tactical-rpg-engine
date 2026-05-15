import React, { useContext, useEffect } from 'react';
import { GameContext, LevelUpAnimation } from '../context/GameContext';
import { motion, AnimatePresence } from 'motion/react';

export default function LevelUpOverlay() {
  const { state, dispatch } = useContext(GameContext);

  return (
    <div className="absolute inset-0 pointer-events-none z-[600] overflow-hidden">
      <AnimatePresence>
        {state.level_up_animations.map((anim) => (
          <LevelUpItem 
            key={anim.id} 
            anim={anim} 
            onComplete={() => dispatch({ type: 'CLEAR_LEVEL_UP_ANIMATION', payload: anim.id })} 
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface LevelUpItemProps {
  anim: LevelUpAnimation;
  onComplete: () => void;
}

const LevelUpItem: React.FC<LevelUpItemProps> = ({ anim, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  // We need to estimate tile size or use a fixed percentage since we don't have the calculated tileSize here
  // But we can use the same logic as BattleGrid if we want it to be precise, 
  // or just use a full-screen centered animation if it's more "celebratory".
  // Let's try to position it near the character.
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: 0 }}
      animate={{ opacity: 1, scale: 1, y: -100 }}
      exit={{ opacity: 0, scale: 1.5, y: -200 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className="absolute flex flex-col items-center justify-center"
      style={{ 
        left: `${anim.x * 10 + 5}%`, 
        top: `${anim.y * 10 + 5}%`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      <motion.div
        animate={{ 
          rotate: [0, 15, -15, 15, 0],
          scale: [1, 1.3, 1, 1.3, 1],
          filter: ["brightness(1)", "brightness(1.5)", "brightness(1)"]
        }}
        transition={{ duration: 0.6, repeat: 3 }}
        className="text-5xl mb-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]"
      >
        ✨🎊✨
      </motion.div>
      
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "auto" }}
        className="overflow-hidden whitespace-nowrap"
      >
        <div className="bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 text-black px-6 py-2 rounded-full font-bold text-xl shadow-[0_0_30px_rgba(234,179,8,0.8)] border-2 border-white uppercase tracking-tighter italic">
          Level Up!
        </div>
      </motion.div>
      
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-white font-bold text-lg mt-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] bg-black/60 px-4 py-1 rounded-lg border border-white/20"
      >
        {anim.name} <span className="text-yellow-400">LV.{anim.level}</span>
      </motion.div>
      
      {/* Burst Particles */}
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ 
            x: (Math.random() - 0.5) * 250, 
            y: (Math.random() - 0.5) * 250,
            opacity: 0,
            scale: 0,
            rotate: Math.random() * 360
          }}
          transition={{ duration: 1.5, delay: 0.1 + Math.random() * 0.2, ease: "easeOut" }}
          className="absolute text-xl pointer-events-none"
        >
          {['⭐', '✨', '💎', '🔥'][Math.floor(Math.random() * 4)]}
        </motion.div>
      ))}

      {/* Radial Glow */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 4], opacity: [0, 0.5, 0] }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="absolute w-20 h-20 bg-yellow-400 rounded-full blur-3xl -z-10"
      />
    </motion.div>
  );
}
