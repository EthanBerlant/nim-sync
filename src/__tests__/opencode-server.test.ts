import { beforeEach, describe, expect, it, vi } from 'vitest'

const refreshModels = vi.fn()
const manualRefresh = vi.fn()

vi.mock('../plugin/nim-sync-service.js', () => ({
  createNIMSyncService: vi.fn(() => ({
    refreshModels,
    manualRefresh
  }))
}))

import plugin from '../plugin/opencode-server.js'

describe('official server plugin', () => {
  beforeEach(() => {
    refreshModels.mockReset()
    manualRefresh.mockReset()
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

  it('does not expose a server-side /nim-refresh prompt hook', async () => {
    const hooks = await plugin.server({
      client: {
        tui: {
          showToast: vi.fn()
        }
      }
    } as any, undefined)

    expect(hooks['command.execute.before']).toBeUndefined()
    expect(manualRefresh).not.toHaveBeenCalled()
  })
})
