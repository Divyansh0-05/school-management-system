'use client';

import { createContext, useContext, useMemo, useState } from 'react';

type Toast = { id: number; message: string; tone: 'success' | 'error' };
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const notify = useMemo(() => (message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now();
    setItems((current) => [...current, { id, message, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4000);
  }, []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2" aria-live="polite">
        {items.map((item) => <div key={item.id} className={`rounded-lg px-4 py-3 text-sm text-white shadow-lg ${item.tone === 'error' ? 'bg-red-700' : 'bg-emerald-700'}`}>{item.message}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
