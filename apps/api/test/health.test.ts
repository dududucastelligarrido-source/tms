import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createApp } from '../src/app.js'
import type { FastifyInstance } from 'fastify'

let app: FastifyInstance

beforeAll(async () => { app = await createApp({ logger: false }) })
afterAll(async () => { await app.close() })

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toMatchObject({ status: 'ok' })
    expect(typeof body.commit).toBe('string')
    expect(typeof body.uptime).toBe('number')
  })
})
