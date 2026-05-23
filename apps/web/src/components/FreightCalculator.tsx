import { useState } from 'react'
import {
  calcularPisoAntt,
  CARGO_LABELS, AXLE_LABELS,
  type CargoType, type AxleConfig,
} from '../lib/anttFreight.js'

interface Props {
  onUse?: (value: number) => void
  currentCartaFrete?: number
}

export default function FreightCalculator({ onUse, currentCartaFrete }: Props) {
  const [open, setOpen] = useState(false)
  const [distance, setDistance] = useState('')
  const [axles, setAxles] = useState<AxleConfig>('5')
  const [cargoType, setCargoType] = useState<CargoType>('carga_geral')

  const result = distance && Number(distance) > 0
    ? calcularPisoAntt(Number(distance), axles, cargoType)
    : null

  const abaixoDoPiso = result && currentCartaFrete != null && currentCartaFrete < result.pisoMinimo

  return (
    <div className="border border-slate-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 hover:bg-slate-750 text-sm font-medium text-slate-300 transition-colors"
      >
        <span>🧮 Calculadora ANTT — Piso Mínimo do Frete</span>
        <span className="text-slate-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="bg-slate-900 p-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Distância (km)</label>
              <input
                type="number" min="1" value={distance}
                onChange={e => setDistance(e.target.value)}
                placeholder="Ex: 850"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Configuração de Eixos</label>
              <select value={axles} onChange={e => setAxles(e.target.value as AxleConfig)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm">
                {(Object.entries(AXLE_LABELS) as [AxleConfig, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1">Tipo de Carga</label>
              <select value={cargoType} onChange={e => setCargoType(e.target.value as CargoType)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm">
                {(Object.entries(CARGO_LABELS) as [CargoType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {result && (
            <div className="bg-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Taxa (R$/km)</p>
                  <p className="text-slate-200 font-mono text-lg">
                    R$ {result.ratePerKm.toFixed(4)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Piso Mínimo ANTT</p>
                  <p className="text-green-400 font-bold font-mono text-2xl">
                    R$ {result.pisoMinimo.toFixed(2)}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                {result.distanceKm} km × R$ {result.ratePerKm.toFixed(4)}/km ·
                Portaria ANTT 23/2023 · Lei 13.703/2018
              </p>

              {abaixoDoPiso && (
                <div className="bg-red-950 border border-red-800 rounded-lg px-3 py-2 text-red-400 text-xs font-medium">
                  ⚠️ Carta de frete (R$ {currentCartaFrete!.toFixed(2)}) está abaixo do piso mínimo
                  da ANTT (R$ {result.pisoMinimo.toFixed(2)}). Diferença: R$ {(result.pisoMinimo - currentCartaFrete!).toFixed(2)}.
                </div>
              )}

              {onUse && (
                <button
                  type="button"
                  onClick={() => onUse(result.pisoMinimo)}
                  className="w-full bg-green-700 hover:bg-green-600 text-white text-sm font-semibold rounded-lg py-2 transition-colors"
                >
                  Usar R$ {result.pisoMinimo.toFixed(2)} como Carta de Frete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
