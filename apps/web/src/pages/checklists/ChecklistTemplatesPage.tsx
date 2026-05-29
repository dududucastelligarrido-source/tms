import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api.js'
import { getUser } from '../../lib/auth.js'
import { useToast } from '../../components/Toast.js'

const TYPE_LABELS: Record<string, string> = {
  departure: 'Saída', arrival: 'Chegada', driver_change: 'Troca de Motorista',
}

const emptyItem = { description: '', isRequired: true, orderIndex: 0 }
const emptyForm = { name: '', type: 'departure' as const, items: [{ ...emptyItem }] }

export default function ChecklistTemplatesPage() {
  const user = getUser()
  const isAdmin = user?.role === 'admin'
  const qc = useQueryClient()

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['checklist-templates'],
    queryFn: () => api.get<any[]>('/checklist-templates'),
  })

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(emptyForm)
  const [editError, setEditError] = useState('')

  const toast = useToast()
  const inputCls = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-blue-500'

  const create = useMutation({
    mutationFn: (data: typeof form) => api.post('/checklist-templates', {
      ...data,
      items: data.items.map((it, i) => ({ ...it, orderIndex: i })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['checklist-templates'] }); setShowForm(false); setForm(emptyForm); setFormError(''); toast.success('Template criado!') },
    onError: (e: any) => { setFormError(e.message); toast.error(e.message) },
  })

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof editForm }) =>
      api.patch(`/checklist-templates/${id}`, {
        ...data,
        items: data.items.map((it, i) => ({ ...it, orderIndex: i })),
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['checklist-templates'] }); setEditingId(null); setEditError(''); toast.success('Template atualizado!') },
    onError: (e: any) => { setEditError(e.message); toast.error(e.message) },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/checklist-templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['checklist-templates'] }); toast.success('Template removido.') },
    onError: (e: any) => toast.error(e.message),
  })

  function startEdit(t: any) {
    setEditingId(t.id)
    setEditForm({
      name: t.name,
      type: t.type,
      items: t.items.map((it: any) => ({ description: it.description, isRequired: it.isRequired, orderIndex: it.orderIndex })),
    })
    setEditError('')
  }

  const ItemsEditor = ({
    items, setItems,
  }: {
    items: { description: string; isRequired: boolean; orderIndex: number }[]
    setItems: (fn: (prev: typeof items) => typeof items) => void
  }) => (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <span className="text-slate-600 text-xs w-4 shrink-0">{idx + 1}.</span>
          <input
            value={item.description}
            onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, description: e.target.value } : it))}
            placeholder="Descrição do item"
            className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-blue-500"
          />
          <label className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
            <input
              type="checkbox"
              checked={item.isRequired}
              onChange={e => setItems(prev => prev.map((it, i) => i === idx ? { ...it, isRequired: e.target.checked } : it))}
              className="accent-blue-500"
            />
            Obrigatório
          </label>
          {items.length > 1 && (
            <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}
              className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
          )}
        </div>
      ))}
      <button
        onClick={() => setItems(prev => [...prev, { description: '', isRequired: true, orderIndex: prev.length }])}
        className="text-blue-400 hover:text-blue-300 text-xs mt-1">
        + Adicionar item
      </button>
    </div>
  )

  const TemplateForm = ({
    f, setF, error, onSave, onCancel, saving, saveLabel,
  }: {
    f: typeof emptyForm
    setF: (fn: (prev: typeof emptyForm) => typeof emptyForm) => void
    error: string; onSave: () => void; onCancel: () => void; saving: boolean; saveLabel: string
  }) => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1">Nome</label>
          <input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} className={inputCls} placeholder="Ex: Checklist de Saída" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Tipo</label>
          <select value={f.type} onChange={e => setF(p => ({ ...p, type: e.target.value as any }))} className={inputCls}>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-400 block mb-2">Itens</label>
        <ItemsEditor
          items={f.items}
          setItems={fn => setF(p => ({ ...p, items: fn(p.items) }))}
        />
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving || !f.name || f.items.some(it => !it.description)}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg px-4 py-2">
          {saving ? 'Salvando...' : saveLabel}
        </button>
        <button onClick={onCancel} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm rounded-lg px-4 py-2">Cancelar</button>
      </div>
    </div>
  )

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-100">Templates de Checklist</h1>
        {isAdmin && !showForm && (
          <button onClick={() => { setShowForm(true); setEditingId(null) }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            + Novo Template
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
          <h2 className="text-sm font-semibold text-slate-300 mb-4">Novo Template</h2>
          <TemplateForm
            f={form} setF={setForm} error={formError}
            onSave={() => create.mutate(form)}
            onCancel={() => { setShowForm(false); setForm(emptyForm); setFormError('') }}
            saving={create.isPending} saveLabel="Criar Template"
          />
        </div>
      )}

      {isLoading ? (
        <p className="text-slate-400 text-sm">Carregando...</p>
      ) : (templates as any[]).length === 0 ? (
        <p className="text-slate-500 text-sm">Nenhum template cadastrado.</p>
      ) : (
        <div className="space-y-4">
          {(templates as any[]).map((t: any) => (
            <div key={t.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              {editingId === t.id ? (
                <div className="p-5">
                  <h3 className="text-sm font-semibold text-slate-300 mb-4">Editar Template</h3>
                  <TemplateForm
                    f={editForm} setF={setEditForm} error={editError}
                    onSave={() => update.mutate({ id: t.id, data: editForm })}
                    onCancel={() => setEditingId(null)}
                    saving={update.isPending} saveLabel="Salvar"
                  />
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                      <span className="text-slate-100 font-medium text-sm">{t.name}</span>
                      <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
                        {TYPE_LABELS[t.type] ?? t.type}
                      </span>
                      <span className="text-xs text-slate-600">{t.items.length} itens</span>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <button onClick={() => startEdit(t)} className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded">Editar</button>
                        <button onClick={() => confirm('Excluir este template?') && remove.mutate(t.id)}
                          className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded">Excluir</button>
                      </div>
                    )}
                  </div>
                  <div className="px-4 py-3 space-y-1.5">
                    {t.items.map((item: any, idx: number) => (
                      <div key={item.id} className="flex items-center gap-2 text-xs">
                        <span className="text-slate-600 w-4">{idx + 1}.</span>
                        <span className="text-slate-300 flex-1">{item.description}</span>
                        {item.isRequired && <span className="text-red-400 text-xs">*</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
