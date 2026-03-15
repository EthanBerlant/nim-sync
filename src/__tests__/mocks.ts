import { vi } from 'vitest'
import type { PluginAPI } from '../types/index.js'
import type { FileHandle } from 'fs/promises'

// Mock type for fs.promises FileHandle
export type MockFileHandle = Pick<FileHandle, 'close'> & {
  close: ReturnType<typeof vi.fn>
  writeFile: ReturnType<typeof vi.fn>
}

// Mock type for fs.stat result
export type MockStats = {
  mtimeMs: number
}

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

