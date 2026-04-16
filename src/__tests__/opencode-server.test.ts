import { beforeEach, describe, expect, it, vi } from 'vitest'

const refreshModels = vi.fn()

vi.mock('../plugin/nim-sync-service.js', () => ({
  createNIMSyncService: vi.fn(() => ({
    refreshModels
  }))
}))

import plugin from '../plugin/opencode-server.js'

describe('official server plugin', () => {
  beforeEach(() => {
    refreshModels.mockReset()
  })

  it('exposes a stable plugin id', () => {
    expect(plugin.id).toBe('nim-sync')
  })

  it('refreshes on server and session lifecycle events without migration side effects', async () => {
    const showToast = vi.fn()
    const log = vi.fn()

    const hooks = await plugin.server({
      client: {
        tui: {
          showToast
        },
        app: {
          log
        }
      }
    } as any, undefined)

    expect(showToast).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()

    await hooks.event?.({ event: { type: 'server.connected' } as any })
    await hooks.event?.({ event: { type: 'session.created' } as any })

    expect(refreshModels).toHaveBeenCalledTimes(2)
  })
})
