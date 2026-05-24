import { motion, AnimatePresence } from 'framer-motion';
import { PhoneCall, Menu } from 'lucide-react';
import { useCallStore } from '../../store/callStore';

export default function Header({ title, onMenuClick }) {
  const activeCalls = useCallStore(s => s.activeCalls);

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-6 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <Menu size={18} />
        </button>
        <h1 className="text-sm font-semibold text-slate-900">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        <AnimatePresence>
          {activeCalls.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-3 py-1"
            >
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              <span className="text-xs text-red-600 font-medium whitespace-nowrap">
                {activeCalls.length} Aktif Çağrı
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
