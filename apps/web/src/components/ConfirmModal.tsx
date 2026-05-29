import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface ConfirmOptions { title?: string; message: string; confirmLabel?: string; danger?: boolean }
type Resolver = (value: boolean) => void

interface ConfirmCtx { confirm: (opts: ConfirmOptions) => Promise<boolean> }
const Ctx = createContext<ConfirmCtx | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [resolver, setResolver] = useState<Resolver | null>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setOpts(options)
      setResolver(() => resolve)
    })
  }, [])

  function handle(value: boolean) {
    resolver?.(value)
    setOpts(null)
    setResolver(null)
  }

  return (
    <Ctx.Provider value={{ confirm }}>
      {children}
      {opts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => handle(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm p-6">
            {opts.title && (
              <h2 className="text-slate-100 font-semibold text-base mb-2">{opts.title}</h2>
            )}
            <p className="text-slate-400 text-sm mb-6">{opts.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => handle(false)}
                className="px-4 py-2 text-sm text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handle(true)}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  opts.danger !== false ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {opts.confirmLabel ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useConfirm(): ConfirmCtx['confirm'] {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useConfirm must be inside ConfirmProvider')
  return ctx.confirm
}
