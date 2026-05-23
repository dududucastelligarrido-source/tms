import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

const STATUS_LABELS: Record<string, string> = { draft: 'Rascunho', active: 'Em Curso', completed: 'Concluída', cancelled: 'Cancelada' }
const COST_LABELS: Record<string, string> = { fuel: 'Combustível', toll: 'Pedágio', meal: 'Refeição', maintenance: 'Manutenção', other: 'Outros' }

function fmt(n: number) { return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('pt-BR') }

export function exportPDF(data: any) {
  const doc = new jsPDF()
  const start = fmtDate(data.period.startDate)
  const end = fmtDate(data.period.endDate)

  doc.setFontSize(16)
  doc.text('Relatório TMS', 14, 15)
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text(`Período: ${start} a ${end}`, 14, 22)

  // Resumo
  doc.setFontSize(12)
  doc.setTextColor(0)
  doc.text('Resumo', 14, 32)
  const kmTotal = data.trips.reduce((s: number, t: any) => s + (t.kmTotal ?? 0), 0)
  autoTable(doc, {
    startY: 35,
    head: [['Total Viagens', 'Concluídas', 'KM Total', 'Custo Total']],
    body: [[
      data.trips.length,
      data.trips.filter((t: any) => t.status === 'completed').length,
      `${kmTotal.toLocaleString('pt-BR')} km`,
      fmt(data.costs.total),
    ]],
    theme: 'grid',
  })

  // Custos por categoria
  const afterSummary = (doc as any).lastAutoTable.finalY + 8
  doc.text('Custos por Categoria', 14, afterSummary)
  autoTable(doc, {
    startY: afterSummary + 3,
    head: [['Categoria', 'Valor']],
    body: Object.entries(data.costs.byCategory).map(([cat, val]: any) => [COST_LABELS[cat] ?? cat, fmt(val)]),
    theme: 'grid',
  })

  // KM por motorista
  const afterCosts = (doc as any).lastAutoTable.finalY + 8
  doc.text('KM por Motorista', 14, afterCosts)
  autoTable(doc, {
    startY: afterCosts + 3,
    head: [['Motorista', 'KM Rodados']],
    body: data.kmByDriver.map((d: any) => [d.name, `${d.km.toLocaleString('pt-BR')} km`]),
    theme: 'grid',
  })

  // KM por veículo
  const afterDriver = (doc as any).lastAutoTable.finalY + 8
  doc.text('KM por Veículo', 14, afterDriver)
  autoTable(doc, {
    startY: afterDriver + 3,
    head: [['Veículo', 'KM Rodados']],
    body: data.kmByVehicle.map((v: any) => [`${v.plate} — ${v.model}`, `${v.km.toLocaleString('pt-BR')} km`]),
    theme: 'grid',
  })

  // Viagens (nova página)
  doc.addPage()
  doc.setFontSize(12)
  doc.text('Viagens no Período', 14, 15)
  autoTable(doc, {
    startY: 20,
    head: [['Data', 'Motorista', 'Veículo', 'Origem', 'Destino', 'KM', 'Status']],
    body: data.trips.map((t: any) => [
      fmtDate(t.createdAt),
      t.driver,
      t.vehicle,
      t.origin,
      t.destination,
      t.kmTotal != null ? `${t.kmTotal} km` : '-',
      STATUS_LABELS[t.status] ?? t.status,
    ]),
    theme: 'grid',
    styles: { fontSize: 8 },
  })

  doc.save(`relatorio-tms-${start}-${end}.pdf`)
}

export function exportExcel(data: any) {
  const wb = XLSX.utils.book_new()
  const start = fmtDate(data.period.startDate)
  const end = fmtDate(data.period.endDate)

  // Viagens
  const tripsRows = data.trips.map((t: any) => ({
    Data: fmtDate(t.createdAt),
    Motorista: t.driver,
    Veículo: t.vehicle,
    Origem: t.origin,
    Destino: t.destination,
    'KM Rodados': t.kmTotal ?? '',
    Status: STATUS_LABELS[t.status] ?? t.status,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tripsRows), 'Viagens')

  // Custos
  const costsRows = Object.entries(data.costs.byCategory).map(([cat, val]: any) => ({
    Categoria: COST_LABELS[cat] ?? cat,
    Total: val,
  }))
  costsRows.push({ Categoria: 'TOTAL', Total: data.costs.total })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(costsRows), 'Custos')

  // KM por motorista
  const driverRows = data.kmByDriver.map((d: any) => ({ Motorista: d.name, 'KM Rodados': d.km }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(driverRows), 'KM por Motorista')

  // KM por veículo
  const vehicleRows = data.kmByVehicle.map((v: any) => ({ Veículo: `${v.plate} — ${v.model}`, 'KM Rodados': v.km }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vehicleRows), 'KM por Veículo')

  XLSX.writeFile(wb, `relatorio-tms-${start}-${end}.xlsx`)
}
