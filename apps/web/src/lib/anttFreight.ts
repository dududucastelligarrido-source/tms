// Piso Mínimo do Frete Rodoviário — Lei 13.703/2018
// Valores vigentes: Portaria ANTT 23/2023 (R$/km)
// Fonte: https://www.antt.gov.br/index.php/content/view/22465

export type CargoType =
  | 'carga_geral'
  | 'granel_solido'
  | 'granel_liquido'
  | 'frigorificada'
  | 'neogranel'

export type AxleConfig = '2' | '3' | '4' | '5' | '6' | '7' | '9'

export const CARGO_LABELS: Record<CargoType, string> = {
  carga_geral: 'Carga Geral',
  granel_solido: 'Granel Sólido',
  granel_liquido: 'Granel Líquido',
  frigorificada: 'Frigorificada / Perecível',
  neogranel: 'Neogranel',
}

export const AXLE_LABELS: Record<AxleConfig, string> = {
  '2': '2 eixos — Veículo simples (VUC/Furgão)',
  '3': '3 eixos — Truck',
  '4': '4 eixos — Carreta simples',
  '5': '5 eixos — Carreta (2+3)',
  '6': '6 eixos — Bi-trem / Rodotrem',
  '7': '7 eixos — Bi-trem pesado',
  '9': '9 eixos — Rodotrem 9 eixos',
}

// R$/km por configuração de eixos e tipo de carga
const TABLE: Record<AxleConfig, Record<CargoType, number>> = {
  '2': { carga_geral: 1.0768, granel_solido: 0.8076, granel_liquido: 0.9422, frigorificada: 1.2921, neogranel: 1.0210 },
  '3': { carga_geral: 1.0793, granel_solido: 0.8095, granel_liquido: 0.9445, frigorificada: 1.2953, neogranel: 1.0233 },
  '4': { carga_geral: 2.5850, granel_solido: 1.9385, granel_liquido: 2.2618, frigorificada: 3.1020, neogranel: 2.4506 },
  '5': { carga_geral: 2.5850, granel_solido: 1.9385, granel_liquido: 2.2618, frigorificada: 3.1020, neogranel: 2.4506 },
  '6': { carga_geral: 3.2313, granel_solido: 2.4231, granel_liquido: 2.8272, frigorificada: 3.8775, neogranel: 3.0633 },
  '7': { carga_geral: 4.6163, granel_solido: 3.4619, granel_liquido: 4.0389, frigorificada: 5.5393, neogranel: 4.3762 },
  '9': { carga_geral: 4.6163, granel_solido: 3.4619, granel_liquido: 4.0389, frigorificada: 5.5393, neogranel: 4.3762 },
}

export interface FreightResult {
  ratePerKm: number
  pisoMinimo: number
  axles: AxleConfig
  cargoType: CargoType
  distanceKm: number
}

export function calcularPisoAntt(
  distanceKm: number,
  axles: AxleConfig,
  cargoType: CargoType,
): FreightResult {
  const ratePerKm = TABLE[axles][cargoType]
  const pisoMinimo = ratePerKm * distanceKm
  return { ratePerKm, pisoMinimo, axles, cargoType, distanceKm }
}
