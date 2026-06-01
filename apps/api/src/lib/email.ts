import { Resend } from 'resend'
import type { TenantAlerts } from './alerts.js'

const { RESEND_API_KEY, EMAIL_FROM } = process.env

export function isEmailConfigured() {
  return !!(RESEND_API_KEY && EMAIL_FROM)
}

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString('pt-BR')
}

function buildAlertEmailHtml(alerts: TenantAlerts): string {
  const { cnhExpiring, maintenanceDue } = alerts

  const cnhRows = cnhExpiring.map(c => {
    const status = c.expired
      ? `<span style="color:#dc2626;font-weight:600">Vencida há ${Math.abs(c.daysLeft)}d</span>`
      : `<span style="color:#d97706;font-weight:600">Vence em ${c.daysLeft}d</span>`
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${c.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">CNH ${c.cnhNumber}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${fmtDate(c.cnhExpiresAt)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${status}</td>
    </tr>`
  }).join('')

  const maintRows = maintenanceDue.map(m => {
    const status = m.overdue
      ? `<span style="color:#dc2626;font-weight:600">Vencida</span>`
      : `<span style="color:#d97706;font-weight:600">Próxima</span>`
    const detail = [
      m.kmRestantes != null ? `${m.kmRestantes <= 0 ? 'Excedeu' : 'Faltam'} ${Math.abs(m.kmRestantes).toLocaleString('pt-BR')} km` : null,
      m.diasRestantes != null ? `${m.diasRestantes <= 0 ? 'Vencida há' : 'Em'} ${Math.abs(m.diasRestantes)}d` : null,
    ].filter(Boolean).join(' · ')
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${m.plate}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${m.model}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${detail || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${status}</td>
    </tr>`
  }).join('')

  const cnhSection = cnhExpiring.length > 0 ? `
    <h2 style="font-size:16px;color:#111827;margin:24px 0 8px">🪪 CNH vencendo (${cnhExpiring.length})</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151">
      <thead><tr style="background:#f9fafb">
        <th style="padding:8px 12px;text-align:left">Motorista</th>
        <th style="padding:8px 12px;text-align:left">CNH</th>
        <th style="padding:8px 12px;text-align:left">Validade</th>
        <th style="padding:8px 12px;text-align:left">Status</th>
      </tr></thead>
      <tbody>${cnhRows}</tbody>
    </table>` : ''

  const maintSection = maintenanceDue.length > 0 ? `
    <h2 style="font-size:16px;color:#111827;margin:24px 0 8px">🔧 Manutenção pendente (${maintenanceDue.length})</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151">
      <thead><tr style="background:#f9fafb">
        <th style="padding:8px 12px;text-align:left">Placa</th>
        <th style="padding:8px 12px;text-align:left">Veículo</th>
        <th style="padding:8px 12px;text-align:left">Detalhe</th>
        <th style="padding:8px 12px;text-align:left">Status</th>
      </tr></thead>
      <tbody>${maintRows}</tbody>
    </table>` : ''

  return `<!DOCTYPE html>
<html lang="pt-BR"><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb">
      <h1 style="font-size:20px;color:#111827;margin:0 0 4px">Alertas — ${alerts.tenantName}</h1>
      <p style="color:#6b7280;font-size:14px;margin:0 0 8px">Resumo diário de pendências da frota.</p>
      ${cnhSection}
      ${maintSection}
      <p style="color:#9ca3af;font-size:12px;margin-top:32px;border-top:1px solid #e5e7eb;padding-top:16px">
        Este é um email automático do TMS. Acesse o sistema para mais detalhes.
      </p>
    </div>
  </div>
</body></html>`
}

/**
 * Sends the daily alert digest to the given recipients.
 * Returns true if an email was sent (skips silently when there are no alerts).
 */
export async function sendAlertDigest(alerts: TenantAlerts, recipients: string[]): Promise<boolean> {
  if (!isEmailConfigured()) throw new Error('Email not configured')
  if (recipients.length === 0) return false
  if (alerts.cnhExpiring.length === 0 && alerts.maintenanceDue.length === 0) return false

  const resend = new Resend(RESEND_API_KEY)
  const totalAlerts = alerts.cnhExpiring.length + alerts.maintenanceDue.length

  await resend.emails.send({
    from: EMAIL_FROM!,
    to: recipients,
    subject: `🚨 ${totalAlerts} alerta${totalAlerts > 1 ? 's' : ''} de frota — ${alerts.tenantName}`,
    html: buildAlertEmailHtml(alerts),
  })

  return true
}
