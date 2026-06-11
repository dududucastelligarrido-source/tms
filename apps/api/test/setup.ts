import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Load .env file manually since vitest doesn't inject process.env from .env
const envPath = resolve(process.cwd(), '.env')
try {
  const envContent = readFileSync(envPath, 'utf8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = val
  }
} catch {
  // .env not found, continue with existing env
}

// cleanDb() wipes every table before each test — refuse to run against anything
// that doesn't look like a dedicated test database.
const testUrl = process.env.DATABASE_URL_TEST
if (!testUrl) {
  throw new Error('DATABASE_URL_TEST is not set — refusing to run tests')
}
if (!/test|localhost|127\.0\.0\.1/i.test(testUrl)) {
  throw new Error(
    'DATABASE_URL_TEST does not look like a test database (expected "test", "localhost" or "127.0.0.1" in the URL) — refusing to run tests against it',
  )
}
process.env.DATABASE_URL = testUrl
process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long'
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-ch'
