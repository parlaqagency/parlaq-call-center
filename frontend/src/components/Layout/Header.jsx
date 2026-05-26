import { motion, AnimatePresence } from 'framer-motion';
import { PhoneCall, Menu } from 'lucide-react';
import { useCallStore } from '../../store/callStore';
import ThemeToggle from '../ThemeToggle';

export default function Header({ title, onMenuClick }) {
  const activeCalls = useCallStore(s => s.activeCalls);

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between px-4 md:px-6 flex-shrink-0 transition-colors duration-200">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <Menu size={18} />
        </button>
        <h1 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <AnimatePresence>
          {activeCalls.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-full px-3 py-1"
            >
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-red-600 dark:text-red-400 font-medium whitespace-nowrap">
                {activeCalls.length} Aktif Çağrı
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        <ThemeToggle />
      </div>
    </header>
  );
}
