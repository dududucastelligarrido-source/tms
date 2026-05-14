import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps'
import { useCreateTrip } from '../../hooks/useTrips.js'
import { useVehicles } from '../../hooks/useVehicles.js'
import { useDrivers } from '../../hooks/useDrivers.js'

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string

export default function NewTripPage() {
  const navigate = useNavigate()
  const createTrip = useCreateTrip()
  const { data: vehicles = [] } = useVehicles()
  const { data: drivers = [] } = useDrivers()

  const [form, setForm] = useState({
    driverId: '', vehicleId: '',
    originAddress: '', originLat: 0, originLng: 0,
    destinationAddress: '', destinationLat: 0, destinationLng: 0,
    kmStart: 0, notes: '',
  })

  function geocodeAddress(address: string, field: 'origin' | 'destination') {
    if (!address || !(window as any).google) return
    const geocoder = new (window as any).google.maps.Geocoder()
    geocoder.geocode({ address }, (results: any, status: string) => {
      if (status === 'OK' && results?.[0]) {
        const loc = results[0].geometry.location
        setForm(f => ({
          ...f,
          [`${field}Lat`]: loc.lat(),
          [`${field}Lng`]: loc.lng(),
        }))
      }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.originAddress && form.originLat === 0) {
      alert('Aguardando geocodificação da origem. Clique fora do campo e tente novamente.')
      return
    }
    if (form.destinationAddress && form.destinationLat === 0) {
      alert('Aguardando geocodificação do destino. Clique fora do campo e tente novamente.')
      return
    }
    const trip = await createTrip.mutateAsync(form)
    navigate(`/trips/${(trip as any).id}`)
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_KEY ?? ''}>
      <div className="p-6 max-w-2xl">
        <button onClick={() => navigate('/trips')} className="text-slate-400 hover:text-slate-200 text-sm mb-4">← Voltar</button>
        <h1 className="text-xl font-bold text-slate-100 mb-6">Nova Viagem</h1>

        <div className="h-48 rounded-xl overflow-hidden mb-6 border border-slate-800">
          <Map defaultCenter={{ lat: -15.77, lng: -47.92 }} defaultZoom={5} mapId="tms-map">
            {form.originLat !== 0 && <Marker position={{ lat: form.originLat, lng: form.originLng }} />}
            {form.destinationLat !== 0 && <Marker position={{ lat: form.destinationLat, lng: form.destinationLng }} />}
          </Map>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Motorista</label>
              <select value={form.driverId} onChange={e => setForm(f => ({ ...f, driverId: e.target.value }))} required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm">
                <option value="">Selecionar...</option>
                {vehicles && drivers && (drivers as any[]).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Veículo</label>
              <select value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))} required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm">
                <option value="">Selecionar...</option>
                {(vehicles as any[]).map((v: any) => <option key={v.id} value={v.id}>{v.plate} — {v.model}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Origem</label>
            <input value={form.originAddress}
              onChange={e => setForm(f => ({ ...f, originAddress: e.target.value }))}
              onBlur={e => geocodeAddress(e.target.value, 'origin')}
              placeholder="Endereço de origem" required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">Destino</label>
            <input value={form.destinationAddress}
              onChange={e => setForm(f => ({ ...f, destinationAddress: e.target.value }))}
              onBlur={e => geocodeAddress(e.target.value, 'destination')}
              placeholder="Endereço de destino" required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 block mb-1">KM Inicial (hodômetro)</label>
            <input type="number" value={form.kmStart} onChange={e => setForm(f => ({ ...f, kmStart: Number(e.target.value) }))} required min={0}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 text-sm"
            />
          </div>

          <button type="submit" disabled={createTrip.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition-colors"
          >
            {createTrip.isPending ? 'Criando...' : 'Criar Viagem'}
          </button>
        </form>
      </div>
    </APIProvider>
  )
}
