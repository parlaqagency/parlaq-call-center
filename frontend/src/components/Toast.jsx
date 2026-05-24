import { create } from 'zustand';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

let id = 0;

export const useToastStore = create((set) => ({
  toasts: [],
  add: (msg, type = 'info') => {
    const toast = { id: ++id, msg, type };
    set(s => ({ toasts: [...s.toasts, toast] }));
    setTimeout(() => set(s => ({ toasts: s.toasts.filter(t => t.id !== toast.id) })), 3500);
  },
  remove: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));

export const toast = {
  success: (msg) => useToastStore.getState().add(msg, 'success'),
  error: (msg) => useToastStore.getState().add(msg, 'error'),
  info: (msg) => useToastStore.getState().add(msg, 'info'),
};

const STYLES = {
  success: { cls: 'bg-white border-emerald-200 text-emerald-700', icon: CheckCircle, iconCls: 'text-emerald-500' },
  error: { cls: 'bg-white border-red-200 text-red-700', icon: XCircle, iconCls: 'text-red-500' },
  info: { cls: 'bg-white border-blue-200 text-blue-700', icon: Info, iconCls: 'text-blue-500' },
};

export default function ToastContainer() {
  const toasts = useToastStore(s => s.toasts);
  const remove = useToastStore(s => s.remove);

  return (
    <div className="fixed bottom-5 right-5 z-[200] space-y-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(t => {
          const style = STYLES[t.type] || STYLES.info;
          const Icon = style.icon;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              className={`pointer-events-auto flex items-center gap-3 border rounded-xl px-4 py-3 shadow-lg min-w-64 max-w-xs ${style.cls}`}
            >
              <Icon size={16} className={style.iconCls} />
              <span className="text-sm flex-1 font-medium">{t.msg}</span>
              <button onClick={() => remove(t.id)} className="text-current opacity-40 hover:opacity-70 transition-opacity">
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
