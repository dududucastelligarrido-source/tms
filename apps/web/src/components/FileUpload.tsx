import { useRef, useState } from 'react'
import { api } from '../lib/api.js'

type UploadContext = 'odometer' | 'receipt' | 'maintenance' | 'checklist'

interface Props {
  context: UploadContext
  onUploaded: (url: string) => void
  existingUrl?: string
  label?: string
  disabled?: boolean
}

const LABEL: Record<UploadContext, string> = {
  odometer: 'Foto do odômetro',
  receipt: 'Foto do recibo',
  maintenance: 'Foto do serviço',
  checklist: 'Foto do item',
}

export function FileUpload({ context, onUploaded, existingUrl, label, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [previewUrl, setPreviewUrl] = useState(existingUrl ?? '')

  async function handleFile(file: File) {
    setError('')
    setUploading(true)
    try {
      const { uploadUrl, fileUrl } = await api.post<{ uploadUrl: string; fileUrl: string }>('/uploads/presign', {
        context,
        contentType: file.type,
        filename: file.name,
      })

      const res = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!res.ok) throw new Error('Falha no upload')

      setPreviewUrl(fileUrl)
      onUploaded(fileUrl)
    } catch (e: any) {
      setError(e.message ?? 'Erro no upload')
    } finally {
      setUploading(false)
    }
  }

  const displayLabel = label ?? LABEL[context]

  return (
    <div className="space-y-2">
      <label className="text-xs text-slate-400 block">{displayLabel}</label>

      {previewUrl && (
        <div className="relative inline-block">
          <a href={previewUrl} target="_blank" rel="noopener noreferrer">
            <img src={previewUrl} alt={displayLabel} className="w-24 h-24 object-cover rounded-lg border border-slate-700" />
          </a>
          <button
            type="button"
            onClick={() => { setPreviewUrl(''); onUploaded('') }}
            className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center leading-none"
            disabled={disabled}
          >
            ×
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        disabled={disabled || uploading}
      />

      {!previewUrl && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-dashed border-slate-600 rounded-lg text-slate-400 text-xs transition-colors"
        >
          {uploading ? (
            <><span className="animate-spin inline-block">⟳</span> Enviando...</>
          ) : (
            <>📎 Anexar foto</>
          )}
        </button>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}
    </div>
  )
}
