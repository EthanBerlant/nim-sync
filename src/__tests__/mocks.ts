import { vi } from 'vitest'
import type { PluginAPI } from '../types/index.js'

export function createMockPluginAPI(overrides?: Partial<PluginAPI>): PluginAPI {
  return {
    config: {
      get: vi.fn(),
      set: vi.fn()
    },
    tui: {
      toast: {
        show: vi.fn()
      }
    },
    command: {
      register: vi.fn(),
      execute: vi.fn()
    },
    ...overrides
  }
}

export function mockFileSystem() {
  const fsMock = {
    readFile: vi.fn().mockResolvedValue('{}'),
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    open: vi.fn().mockResolvedValue({ close: vi.fn() }),
    copyFile: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({ mtimeMs: Date.now() })
  }

  vi.doMock('fs/promises', () => fsMock)
  vi.doMock('path', () => ({
    join: (...args: string[]) => args.join('/').replace(/\\/g, '/'),
    dirname: (p: string) => p.split('/').slice(0, -1).join('/').replace(/\\/g, '/'),
    basename: (p: string) => p.split('/').pop() || ''
  }))

  vi.doMock('crypto', () => ({
    createHash: (algorithm: string) => ({
      update: (data: string) => ({
        digest: (encoding: string) => {
          // Simple hash for testing that different inputs produce different outputs
          const models = JSON.parse(data)
          const modelIds = models.map((m: any) => m.id).sort().join(',')
          return `hash-${modelIds.length}-${algorithm}-${encoding}`
        }
      })
    })
  }))

  return fsMock
}