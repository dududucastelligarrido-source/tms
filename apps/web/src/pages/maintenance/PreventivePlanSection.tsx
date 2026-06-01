import { useState } from 'react'
import { useMaintenancePlans, useCreateMaintenancePlan, useDeleteMaintenancePlan } from '../../hooks/useMaintenancePlans.js'
import { useToast } from '../../components/Toast.js'
import { useConfirm } from '../../components/ConfirmModal.js'

const TYPE_LABELS: Record<string, string> = {
  troca_oleo: 'Troca de Óleo', pneu: 'Pneu', freio: 'Freio', filtro: 'Filtro',
  correia: 'Correia', revisao_geral: 'Revisão Geral', eletrica: 'Elétrica', outro: 'Outro',
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  overdue: { label: 'Vencida', cls: 'bg-red-950 text-red-400' },
  pending: { label: 'Nunca feita', cls: 'bg-purple-950 text-purple-400' },
  warning: { label: 'Próxima', cls: 'bg-amber-950 text-amber-400' },
  ok: { label: 'Em dia', cls: 'bg-slate-800 text-slate-400' },
}

const EMPTY = { type: 'troca_oleo', intervalKm: '', intervalDays: '' }

export default function PreventivePlanSection({ vehicleId, isAdmin }: { vehicleId: string; isAdmin: boolean }) {
  const { data: plans = [], isLoading } = useMaintenancePlans(vehicleId)
  const createPlan = useCreateMaintenancePlan(vehicleId)
  const deletePlan = useDeleteMaintenancePlan(vehicleId)
  const toast = useToast()
  const confirm = useConfirm()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100'

  async function handleCreate() {
    setError('')
    if (!form.intervalKm && !form.intervalDays) { setError('Informe um intervalo por KM e/ou por dias'); return }
    try {
      await createPlan.mutateAsync({
        type: form.type,
        ...(form.intervalKm ? { intervalKm: Number(form.intervalKm) } : {}),
        ...(form.intervalDays ? { intervalDays: Number(form.intervalDays) } : {}),
      })
      setForm(EMPTY); setShowForm(false)
      toast.success('Plano adicionado!')
    } catch (e: any) { setError(e.message); toast.error(e.message) }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-300">Plano de manutenção preventiva</h2>
        {isAdmin && (
          <button onClick={() => setShowForm(s => !s)} className="text-xs text-blue-400 hover:text-blue-300">
            {showForm ? 'Cancelar' : '+ Adicionar plano'}
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Tipo</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">A cada (KM)</label>
              <input type="number" min="1" value={form.intervalKm} onChange={e => setForm(f => ({ ...f, intervalKm: e.target.value }))} className={inputCls} placeholder="Ex: 10000" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">A cada (dias)</label>
              <input type="number" min="1" value={form.intervalDays} onChange={e => setForm(f => ({ ...f, intervalDays: e.target.value }))} className={inputCls} placeholder="Ex: 180" />
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button onClick={handleCreate} disabled={createPlan.isPending}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg px-3 py-1.5">
            {createPlan.isPending ? 'Salvando...' : 'Salvar plano'}
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-500 text-sm">Carregando...</p>
      ) : (plans as any[]).length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhum plano definido. Defina intervalos por tipo para acompanhar vencimentos automaticamente.</p>
      ) : (
        <div className="space-y-2">
          {(plans as any[]).map((p: any) => {
            const cfg = STATUS_CFG[p.status] ?? STATUS_CFG.ok
            const intervalText = [
              p.intervalKm ? `${p.intervalKm.toLocaleString('pt-BR')} km` : null,
              p.intervalDays ? `${p.intervalDays} dias` : null,
            ].filter(Boolean).join(' / ')
            const dueText = p.status === 'pending'
              ? 'Registre a primeira manutenção deste tipo'
              : [
                  p.kmRemaining != null ? (p.kmRemaining <= 0 ? `${Math.abs(p.kmRemaining).toLocaleString('pt-BR')} km atrasada` : `faltam ${p.kmRemaining.toLocaleString('pt-BR')} km`) : null,
                  p.daysRemaining != null ? (p.daysRemaining <= 0 ? `${Math.abs(p.daysRemaining)} dias atrasada` : `em ${p.daysRemaining} dias`) : null,
                ].filter(Boolean).join(' · ')
            return (
              <div key={p.planId} className="flex items-center justify-between border border-slate-800 rounded-lg px-3 py-2">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${cfg.cls}`}>{cfg.label}</span>
                  <div className="min-w-0">
                    <div className="text-slate-200 text-sm">{TYPE_LABELS[p.type] ?? p.type} <span className="text-slate-500 text-xs">· a cada {intervalText}</span></div>
                    <div className="text-slate-400 text-xs">{dueText}</div>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={async () => { if (await confirm({ title: 'Remover plano', message: `Remover o plano de ${TYPE_LABELS[p.type] ?? p.type}?` })) deletePlan.mutate(p.planId, { onSuccess: () => toast.success('Plano removido.'), onError: (e: any) => toast.error(e.message) }) }}
                    className="text-red-400 hover:text-red-300 text-xs shrink-0 ml-3">
                    Remover
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
