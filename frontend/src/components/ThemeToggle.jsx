import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';

export default function ThemeToggle() {
  const theme = useThemeStore(s => s.theme);
  const toggleTheme = useThemeStore(s => s.toggleTheme);
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="relative flex items-center w-12 h-6.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 p-0.5 cursor-pointer transition-colors duration-300 focus:outline-none"
      aria-label="Temayı Değiştir"
    >
      <div className="absolute inset-0 flex items-center justify-between px-1.5 text-slate-400 dark:text-slate-500 pointer-events-none select-none">
        <Sun size={10} className="dark:opacity-100 opacity-20" />
        <Moon size={10} className="dark:opacity-20 opacity-100" />
      </div>
      <motion.div
        className="w-5 h-5 rounded-full bg-white dark:bg-slate-950 shadow-md flex items-center justify-center border border-slate-200/50 dark:border-slate-800 z-10"
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          marginLeft: isDark ? 'auto' : '0px',
        }}
      >
        {isDark ? (
          <Moon size={10} className="text-violet-400" fill="currentColor" />
        ) : (
          <Sun size={10} className="text-amber-500" />
        )}
      </motion.div>
    </button>
  );
}
