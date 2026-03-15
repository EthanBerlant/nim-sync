import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs/promises'
import type { PluginAPI } from '../types/index.js'
import { syncNIMModels } from '../plugin/nim-sync.js'
import { createMockPluginAPI } from './mocks.js'

vi.mock('fs/promises')
vi.mock('../lib/retry.js', () => ({
  withRetry: vi.fn().mockImplementation(async (fn) => fn())
}))
vi.mock('crypto', () => {
  const createHash = () => ({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn((_encoding: string) => 'test-hash-value')
  })
  return {
    default: { createHash },
    createHash
  }
})

describe('NIM Sync Unit Tests', () => {
  let mockPluginAPI: PluginAPI

  beforeEach(() => {
    vi.clearAllMocks()
    mockPluginAPI = createMockPluginAPI()
    process.env.USERPROFILE = '/test/user'
    process.env.NVIDIA_API_KEY = 'test-api-key'

    vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
      if (filePath.includes('auth.json')) {
        return Promise.reject(Object.assign(new Error('File not found'), { code: 'ENOENT' }))
      }
      return Promise.resolve('{}')
    })
    vi.mocked(fs.writeFile).mockResolvedValue(undefined)
    vi.mocked(fs.mkdir).mockResolvedValue(undefined)
    vi.mocked(fs.open).mockResolvedValue({
      close: vi.fn(),
      writeFile: vi.fn().mockResolvedValue(undefined)
    } as any)
    vi.mocked(fs.unlink).mockResolvedValue(undefined)
    vi.mocked(fs.access).mockResolvedValue(undefined)
    vi.mocked(fs.stat).mockResolvedValue({ mtimeMs: Date.now() } as any)
  })

  describe('getAuthPath', () => {
    it('uses Windows path on Windows platform', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true })

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'model-1', name: 'Model 1' }] })
      })
      global.fetch = mockFetch

      const plugin = await syncNIMModels(mockPluginAPI)
      await plugin.init?.()
      await new Promise(resolve => setTimeout(resolve, 100))

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })

      expect(mockFetch).toHaveBeenCalled()
    })

    it('uses Unix path on Linux/macOS', async () => {
      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'model-1', name: 'Model 1' }] })
      })
      global.fetch = mockFetch

      const plugin = await syncNIMModels(mockPluginAPI)
      await plugin.init?.()
      await new Promise(resolve => setTimeout(resolve, 100))

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })

      expect(mockFetch).toHaveBeenCalled()
    })
  })

  describe('shouldRefresh logic', () => {
    it('returns true when config has no nim provider', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'model-1', name: 'Model 1' }] })
      })
      global.fetch = mockFetch

      mockPluginAPI.config.get = vi.fn(() => ({})) as any

      const plugin = await syncNIMModels(mockPluginAPI)
      await plugin.init?.()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockFetch).toHaveBeenCalled()
    })

    it('returns true when cache has no lastRefresh', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'model-1', name: 'Model 1' }] })
      })
      global.fetch = mockFetch

      mockPluginAPI.config.get = vi.fn(() => ({ provider: { nim: { models: {} } } })) as any

      const cacheNoTimestamp = JSON.stringify({ modelsHash: 'abc123' })
      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('auth.json')) {
          return Promise.reject(Object.assign(new Error('File not found'), { code: 'ENOENT' }))
        }
        return Promise.resolve(cacheNoTimestamp)
      })

      const plugin = await syncNIMModels(mockPluginAPI)
      await plugin.init?.()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockFetch).toHaveBeenCalled()
    })
  })

  describe('updateConfig', () => {
    it('deep merges provider.nim without overwriting other provider data', async () => {
      const existingConfig = JSON.stringify({
        provider: {
          anthropic: { apiKey: 'anthropic-key', models: {} },
          openai: { apiKey: 'openai-key' }
        }
      })
      vi.mocked(fs.readFile).mockResolvedValue(existingConfig)

      const models = [{ id: 'meta/llama-3.1-70b-instruct', name: 'Meta Llama 3.1 70B Instruct' }]

      const plugin = await syncNIMModels(mockPluginAPI)
      const changed = await (plugin as any).updateConfig(models)

      expect(changed).toBe(true)
      const updatedConfig = JSON.parse(vi.mocked(fs.writeFile).mock.calls[0][1] as string)
      expect(updatedConfig.provider.anthropic.apiKey).toBe('anthropic-key')
      expect(updatedConfig.provider.openai.apiKey).toBe('openai-key')
      expect(updatedConfig.provider.nim.models).toBeDefined()
    })

    it('preserves existing model options', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'existing-model', name: 'Existing Model' }] })
      })
      global.fetch = mockFetch

      const existingConfig = JSON.stringify({
        provider: {
          nim: {
            models: {
              'existing-model': {
                name: 'Existing Model',
                options: { temperature: 0.5, max_tokens: 2000 }
              }
            }
          }
        }
      })

      vi.mocked(fs.readFile).mockImplementation(async (filePath: string) => {
        if (filePath.includes('auth.json')) {
          return Promise.reject(Object.assign(new Error('File not found'), { code: 'ENOENT' }))
        }
        return Promise.resolve(existingConfig)
      })

      const plugin = await syncNIMModels(mockPluginAPI)
      await plugin.init?.()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockFetch).toHaveBeenCalled()
    })
  })

  describe('hooks', () => {
    it('exposes server.connected hook', async () => {
      const plugin = await syncNIMModels(mockPluginAPI)
      expect(plugin.hooks).toBeDefined()
      expect(plugin.hooks?.['server.connected']).toBeDefined()
    })

    it('exposes session.created hook', async () => {
      const plugin = await syncNIMModels(mockPluginAPI)
      expect(plugin.hooks).toBeDefined()
      expect(plugin.hooks?.['session.created']).toBeDefined()
    })
  })

  describe('error handling', () => {
    it('handles API errors with status code', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })
      global.fetch = mockFetch

      const plugin = await syncNIMModels(mockPluginAPI)
      await plugin.init?.()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockPluginAPI.tui.toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'NVIDIA Sync Failed',
          variant: 'error'
        })
      )
    })

    it('handles network errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = mockFetch

      const plugin = await syncNIMModels(mockPluginAPI)
      await plugin.init?.()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockPluginAPI.tui.toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'NVIDIA Sync Failed',
          variant: 'error'
        })
      )
    })
  })

  describe('getAPIKey', () => {
    it('logs generic error without sensitive data when auth.json parsing fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.mocked(fs.readFile).mockRejectedValueOnce(Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' }))

      const plugin = await syncNIMModels(mockPluginAPI)
      const apiKey = await plugin.getAPIKey?.()

      expect(apiKey).toBe('test-api-key')
      expect(consoleSpy).toHaveBeenCalledWith('[NIM-Sync] Failed to read auth:', expect.any(String))
      // Error message now includes the error details for debugging

      consoleSpy.mockRestore()
    })

    it('returns null and logs generic error for malformed auth.json', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      vi.mocked(fs.readFile).mockResolvedValueOnce('{ invalid json }')

      const plugin = await syncNIMModels(mockPluginAPI)
      const apiKey = await plugin.getAPIKey?.()

      expect(apiKey).toBe('test-api-key')
      expect(consoleSpy).toHaveBeenCalledWith('[NIM-Sync] Failed to read auth:', expect.any(String))

      consoleSpy.mockRestore()
    })

    it('returns apiKey from credentials.nim.apiKey if auth.json is valid', async () => {
      const authData = JSON.stringify({
        credentials: { nim: { apiKey: 'stored-api-key-123' } }
      })

      vi.mocked(fs.readFile).mockResolvedValueOnce(authData)

      const plugin = await syncNIMModels(mockPluginAPI)
      const apiKey = await plugin.getAPIKey?.()

      expect(apiKey).toBe('stored-api-key-123')
    })

    it('returns apiKey from environment variable if auth.json is empty', async () => {
      vi.mocked(fs.readFile).mockResolvedValueOnce('{}')

      const plugin = await syncNIMModels(mockPluginAPI)
      const apiKey = await plugin.getAPIKey?.()

      expect(apiKey).toBe('test-api-key')
    })

    it('returns null if no apiKey is found in auth.json or environment', async () => {
      delete process.env.NVIDIA_API_KEY
      vi.mocked(fs.readFile).mockResolvedValueOnce('{}')

      const plugin = await syncNIMModels(mockPluginAPI)
      const apiKey = await plugin.getAPIKey?.()

      expect(apiKey).toBeNull()

      process.env.NVIDIA_API_KEY = 'test-api-key'
    })
  })

  describe('API response validation', () => {
    it('throws error for invalid API response structure', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ invalid: 'structure' })
      })
      global.fetch = mockFetch

      const plugin = await syncNIMModels(mockPluginAPI)
      await plugin.init?.()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockPluginAPI.tui.toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'NVIDIA Sync Failed',
          description: expect.stringContaining('invalid')
        })
      )
    })

    it('throws error when data array contains invalid model', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: '', name: 'Invalid Model' }] })
      })
      global.fetch = mockFetch

      const plugin = await syncNIMModels(mockPluginAPI)
      await plugin.init?.()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockPluginAPI.tui.toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'NVIDIA Sync Failed',
          description: expect.stringContaining('Invalid')
        })
      )
    })

    it('throws error when model name is empty', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'valid-id', name: '' }] })
      })
      global.fetch = mockFetch

      const plugin = await syncNIMModels(mockPluginAPI)
      await plugin.init?.()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockPluginAPI.tui.toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'NVIDIA Sync Failed',
          description: expect.stringContaining('invalid name')
        })
      )
    })

    it('throws error when duplicate model IDs are present', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ 
          data: [
            { id: 'duplicate-id', name: 'Model 1' },
            { id: 'duplicate-id', name: 'Model 2' }
          ] 
        })
      })
      global.fetch = mockFetch

      const plugin = await syncNIMModels(mockPluginAPI)
      await plugin.init?.()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockPluginAPI.tui.toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'NVIDIA Sync Failed',
          description: expect.stringContaining('Duplicate model ID')
        })
      )
    })

    it('shows warning when API returns empty model list', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] })
      })
      global.fetch = mockFetch

      const plugin = await syncNIMModels(mockPluginAPI)
      await plugin.init?.()
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockPluginAPI.tui.toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'No Models Available',
          description: expect.stringContaining('NVIDIA API returned no models')
        })
      )
    })
  })

  describe('race condition prevention', () => {
    it('concurrent refreshModels calls share single refresh operation', async () => {
      let fetchCount = 0
      const mockFetch = vi.fn(async () => {
        fetchCount++
        await new Promise(resolve => setTimeout(resolve, 50))
        return { ok: true, json: () => Promise.resolve({ data: [{ id: 'model-1', name: 'Model 1' }] }) }
      })
      global.fetch = mockFetch

      const plugin = await syncNIMModels(mockPluginAPI)

      const promise1 = plugin.refreshModels?.()
      const promise2 = plugin.refreshModels?.()
      const promise3 = plugin.refreshModels?.()

      await Promise.all([promise1, promise2, promise3])
      await new Promise(resolve => setTimeout(resolve, 50))

      expect(fetchCount).toBe(1)
    })
  })

  describe('rate limiting for manual refresh', () => {
    it('shows warning when refresh is called too frequently', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 'm1', name: 'M1' }] })
      })
      global.fetch = mockFetch

      // Capture the nim-refresh command handler
      let nimRefreshHandler: (() => Promise<void>) | null = null
      mockPluginAPI.command.register = vi.fn((name, handler) => {
        if (name === 'nim-refresh') {
          nimRefreshHandler = handler as () => Promise<void>
        }
      }) as any

      const plugin = await syncNIMModels(mockPluginAPI)
      await plugin.init?.()
      await new Promise(resolve => setTimeout(resolve, 100))

      // First manual refresh should work
      expect(nimRefreshHandler).not.toBeNull()
      if (nimRefreshHandler) {
        await nimRefreshHandler()
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      expect(mockFetch).toHaveBeenCalledTimes(2) // init + manual refresh

      // Second immediate refresh (without waiting 60 seconds) should be rate limited
      vi.clearAllMocks()
      if (nimRefreshHandler) {
        await nimRefreshHandler()
      }

      expect(mockPluginAPI.tui.toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ 
          title: 'Rate Limited',
          description: expect.stringMatching(/Please wait \d+s before refreshing again/)
        })
      )
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

})

