import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminMobileFilterProps {
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

export function AdminMobileFilter({ isOpen, onToggle, children, className = '' }: AdminMobileFilterProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const content = (
    <div className={`max-[1050px]:block min-[1050px]:hidden ${className}`}>
      {/* Toggle Button */}
      <button 
        onClick={onToggle} 
        className="fixed top-[45px] left-1/2 md:left-[calc(50%+130px)] -translate-x-1/2 w-[120px] h-[16px] flex items-center justify-center cursor-pointer text-[var(--text-secondary)] hover:text-indigo-500 transition-colors outline-none z-[60]"
      >
        <svg 
          className="absolute inset-0 w-full h-full" 
          viewBox="0 0 120 16" 
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="none"
        >
          <path 
            d="M 0 15 C 30 15, 40 0, 60 0 C 80 0, 90 15, 120 15 L 120 16 L 0 16 Z" 
            fill={isOpen ? "var(--bg-card)" : "var(--bg-primary)"}
            className="transition-colors duration-300"
          />
          <path 
            d="M 0 15 C 30 15, 40 0, 60 0 C 80 0, 90 15, 120 15" 
            stroke="var(--border)" 
            strokeWidth="1"
            fill="none" 
          />
        </svg>
        <ChevronDown 
          size={18} 
          className={`relative z-10 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
          style={{ marginBottom: '2px' }}
        />
      </button>

      {/* Mobile Filters Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed top-[60px] left-0 right-0 h-[100vh] bg-black/20 dark:bg-black/40 z-[60]"
              onClick={onToggle}
            />

            {/* Dropdown Panel */}
            <motion.div
              initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
              animate={{ height: 'auto', opacity: 1, overflow: 'visible' }}
              exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
              transition={{ duration: 0.3 }}
              className="fixed top-[60px] left-0 md:left-[260px] right-0 z-[60] origin-top"
            >
              <div
                style={{padding:'10px'}}
              className="flex flex-col gap-4 p-4 bg-[var(--bg-card)] rounded-b-2xl shadow-xl border-b border-[var(--border)]">
                {children}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );

  if (!mounted || typeof document === 'undefined') return null;

  return createPortal(content, document.body);
}
