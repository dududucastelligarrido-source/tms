import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

const STATUS_LABELS: Record<string, string> = { draft: 'Rascunho', active: 'Em Curso', completed: 'Concluída', cancelled: 'Cancelada' }
const COST_LABELS: Record<string, string> = { fuel: 'Combustível', toll: 'Pedágio', meal: 'Refeição', maintenance: 'Manutenção', other: 'Outros' }

function fmt(n: number) { return `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('pt-BR') }
function lastY(doc: jsPDF) { return (doc as any).lastAutoTable.finalY }

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
  let y = lastY(doc) + 8
  doc.text('Custos por Categoria', 14, y)
  autoTable(doc, {
    startY: y + 3,
    head: [['Categoria', 'Valor']],
    body: Object.entries(data.costs.byCategory).map(([cat, val]: any) => [COST_LABELS[cat] ?? cat, fmt(val)]),
    theme: 'grid',
  })

  // Combustível
  if (data.costs?.fuel) {
    y = lastY(doc) + 8
    doc.text('Combustível', 14, y)
    autoTable(doc, {
      startY: y + 3,
      head: [['Total Litros', 'Gasto Total', 'Média km/L']],
      body: [[
        `${Number(data.costs.fuel.totalLiters).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} L`,
        fmt(data.costs.fuel.totalSpend),
        data.costs.fuel.avgKmL ? `${data.costs.fuel.avgKmL} km/L` : '—',
      ]],
      theme: 'grid',
    })
    if (data.costs.fuel.byVehicle?.length > 0) {
      y = lastY(doc) + 4
      autoTable(doc, {
        startY: y,
        head: [['Veículo', 'Litros', 'Gasto']],
        body: data.costs.fuel.byVehicle.map((v: any) => [
          `${v.plate} — ${v.model}`,
          `${Number(v.liters).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} L`,
          fmt(v.spend),
        ]),
        theme: 'grid',
        styles: { fontSize: 9 },
      })
    }
  }

  // KM por motorista
  y = lastY(doc) + 8
  doc.text('KM por Motorista', 14, y)
  autoTable(doc, {
    startY: y + 3,
    head: [['Motorista', 'KM Rodados']],
    body: data.kmByDriver.map((d: any) => [d.name, `${d.km.toLocaleString('pt-BR')} km`]),
    theme: 'grid',
  })

  // KM por veículo
  y = lastY(doc) + 8
  doc.text('KM por Veículo', 14, y)
  autoTable(doc, {
    startY: y + 3,
    head: [['Veículo', 'KM Rodados']],
    body: data.kmByVehicle.map((v: any) => [`${v.plate} — ${v.model}`, `${v.km.toLocaleString('pt-BR')} km`]),
    theme: 'grid',
  })

  // Custo por veículo
  if (data.costByVehicle?.length > 0) {
    y = lastY(doc) + 8
    doc.text('Custo por Veículo', 14, y)
    autoTable(doc, {
      startY: y + 3,
      head: [['Veículo', 'Custos Viagem', 'Combustível', 'Total']],
      body: data.costByVehicle.map((v: any) => [
        `${v.plate} — ${v.model}`,
        fmt(v.tripCosts),
        fmt(v.fuelCosts),
        fmt(v.total),
      ]),
      theme: 'grid',
    })
  }

  // Performance por motorista
  doc.addPage()
  doc.setFontSize(12)
  doc.text('Performance por Motorista', 14, 15)
  if (data.trips.length > 0) {
    const byDriver: Record<string, { name: string; total: number; completed: number; cancelled: number; km: number }> = {}
    for (const t of data.trips) {
      if (!byDriver[t.driver]) byDriver[t.driver] = { name: t.driver, total: 0, completed: 0, cancelled: 0, km: 0 }
      byDriver[t.driver].total++
      if (t.status === 'completed') byDriver[t.driver].completed++
      if (t.status === 'cancelled') byDriver[t.driver].cancelled++
      byDriver[t.driver].km += t.kmTotal ?? 0
    }
    autoTable(doc, {
      startY: 20,
      head: [['Motorista', 'Viagens', 'Concluídas', 'Canceladas', 'Taxa', 'KM Total']],
      body: Object.values(byDriver).sort((a, b) => b.km - a.km).map(r => [
        r.name, r.total, r.completed, r.cancelled,
        `${r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0}%`,
        `${r.km.toLocaleString('pt-BR')} km`,
      ]),
      theme: 'grid',
    })
  }

  // Viagens
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
    'Custo Viagem': t.totalCosts ?? '',
    Status: STATUS_LABELS[t.status] ?? t.status,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tripsRows), 'Viagens')

  // Custos por categoria
  const costsRows = Object.entries(data.costs.byCategory).map(([cat, val]: any) => ({
    Categoria: COST_LABELS[cat] ?? cat,
    Total: val,
  }))
  costsRows.push({ Categoria: 'TOTAL', Total: data.costs.total })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(costsRows), 'Custos')

  // Combustível
  if (data.costs?.fuel?.byVehicle?.length > 0) {
    const fuelRows = [
      { Veículo: 'TOTAL', Litros: data.costs.fuel.totalLiters, 'Gasto (R$)': data.costs.fuel.totalSpend, 'Média km/L': data.costs.fuel.avgKmL ?? '-' },
      ...data.costs.fuel.byVehicle.map((v: any) => ({
        Veículo: `${v.plate} — ${v.model}`,
        Litros: v.liters,
        'Gasto (R$)': v.spend,
        'Média km/L': '-',
      })),
    ]
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fuelRows), 'Combustível')
  }

  // Custo por veículo
  if (data.costByVehicle?.length > 0) {
    const vehicleCostRows = data.costByVehicle.map((v: any) => ({
      Veículo: `${v.plate} — ${v.model}`,
      'Custos Viagem (R$)': v.tripCosts,
      'Combustível (R$)': v.fuelCosts,
      'Total (R$)': v.total,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vehicleCostRows), 'Custo por Veículo')
  }

  // Performance por motorista
  if (data.trips.length > 0) {
    const byDriver: Record<string, { name: string; total: number; completed: number; cancelled: number; km: number }> = {}
    for (const t of data.trips) {
      if (!byDriver[t.driver]) byDriver[t.driver] = { name: t.driver, total: 0, completed: 0, cancelled: 0, km: 0 }
      byDriver[t.driver].total++
      if (t.status === 'completed') byDriver[t.driver].completed++
      if (t.status === 'cancelled') byDriver[t.driver].cancelled++
      byDriver[t.driver].km += t.kmTotal ?? 0
    }
    const perfRows = Object.values(byDriver).sort((a, b) => b.km - a.km).map(r => ({
      Motorista: r.name,
      'Total Viagens': r.total,
      Concluídas: r.completed,
      Canceladas: r.cancelled,
      'Taxa (%)': r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0,
      'KM Total': r.km,
    }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(perfRows), 'Performance Motoristas')
  }

  // KM por motorista
  const driverRows = data.kmByDriver.map((d: any) => ({ Motorista: d.name, 'KM Rodados': d.km }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(driverRows), 'KM por Motorista')

  // KM por veículo
  const vehicleRows = data.kmByVehicle.map((v: any) => ({ Veículo: `${v.plate} — ${v.model}`, 'KM Rodados': v.km }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vehicleRows), 'KM por Veículo')

  XLSX.writeFile(wb, `relatorio-tms-${start}-${end}.xlsx`)
}
