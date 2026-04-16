import { beforeEach, describe, expect, it, vi } from 'vitest'

const manualRefresh = vi.fn()

vi.mock('../plugin/nim-sync-service.js', () => ({
  createNIMSyncService: vi.fn(() => ({
    manualRefresh
  }))
}))

import plugin from '../plugin/opencode-tui.js'

describe('official TUI plugin', () => {
  beforeEach(() => {
    manualRefresh.mockReset()
  })

  it('registers /nim-refresh as a slash command for autocomplete', async () => {
    let commandFactory: (() => Array<Record<string, unknown>>) | undefined

    await plugin.tui({
      command: {
        register: vi.fn((cb: () => Array<Record<string, unknown>>) => {
          commandFactory = cb
          return () => {}
        })
      }
    } as any, undefined, {
      state: 'same',
      id: 'nim-sync',
      source: 'npm',
      spec: 'nim-sync',
      target: 'file:///nim-sync',
      first_time: Date.now(),
      last_time: Date.now(),
      time_changed: Date.now(),
      load_count: 1,
      fingerprint: 'nim-sync:tui'
    })

    expect(commandFactory).toBeTypeOf('function')

    const commands = commandFactory!()
    expect(commands).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: 'nim.refresh',
          slash: {
            name: 'nim-refresh'
          }
        })
      ])
    )
  })

  it('runs a manual refresh when the command is selected', async () => {
    let commandFactory: (() => Array<Record<string, unknown>>) | undefined

    await plugin.tui({
      command: {
        register: vi.fn((cb: () => Array<Record<string, unknown>>) => {
          commandFactory = cb
          return () => {}
        })
      }
    } as any, undefined, {
      state: 'same',
      id: 'nim-sync',
      source: 'npm',
      spec: 'nim-sync',
      target: 'file:///nim-sync',
      first_time: Date.now(),
      last_time: Date.now(),
      time_changed: Date.now(),
      load_count: 1,
      fingerprint: 'nim-sync:tui'
    })

    const refreshCommand = commandFactory!().find((command) => command.value === 'nim.refresh') as {
      onSelect?: () => void
    }

    refreshCommand.onSelect?.()

    expect(manualRefresh).toHaveBeenCalledTimes(1)
  })
})
