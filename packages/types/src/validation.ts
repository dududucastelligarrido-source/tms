/** Valida CPF usando algoritmo Mod-11 dos dígitos verificadores. */
export function isValidCPF(raw: string): boolean {
  const cpf = raw.replace(/\D/g, '')
  if (cpf.length !== 11) return false
  if (/^(\d)\1+$/.test(cpf)) return false // todos os dígitos iguais

  let sum = 0
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i)
  let rem = (sum * 10) % 11
  if (rem >= 10) rem = 0
  if (rem !== parseInt(cpf[9])) return false

  sum = 0
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i)
  rem = (sum * 10) % 11
  if (rem >= 10) rem = 0
  return rem === parseInt(cpf[10])
}

/** Valida placa brasileira — formato antigo (ABC-1234) ou Mercosul (ABC1D234). */
export function isValidPlate(raw: string): boolean {
  const plate = raw.replace('-', '').toUpperCase()
  const old = /^[A-Z]{3}\d{4}$/       // ABC1234
  const mercosul = /^[A-Z]{3}\d[A-Z]\d{2}$/  // ABC1D23
  return old.test(plate) || mercosul.test(plate)
}
