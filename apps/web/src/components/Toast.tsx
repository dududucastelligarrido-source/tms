import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

type ToastType = 'success' | 'error' | 'info'
interface Toast { id: number; message: string; type: ToastType }

interface ToastCtx { success: (msg: string) => void; error: (msg: string) => void; info: (msg: string) => void }

const Ctx = createContext<ToastCtx | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const add = useCallback((message: string, type: ToastType) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const value: ToastCtx = {
    success: (msg) => add(msg, 'success'),
    error: (msg) => add(msg, 'error'),
    info: (msg) => add(msg, 'info'),
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-3 rounded-lg text-sm font-medium shadow-xl max-w-sm animate-in slide-in-from-right-5 ${
            t.type === 'success' ? 'bg-green-900 border border-green-700 text-green-200' :
            t.type === 'error'   ? 'bg-red-900 border border-red-700 text-red-200' :
                                   'bg-slate-800 border border-slate-700 text-slate-200'
          }`}>
            {t.type === 'success' ? '✓ ' : t.type === 'error' ? '✕ ' : 'ℹ '}{t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}
