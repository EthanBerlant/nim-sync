import crypto from 'crypto'
import path from 'path'
import type { PluginAPI, NIMModel, OpenCodeConfig, CacheData } from '../types/index.js'
import {
  readJSONC,
  writeJSONC,
  acquireLock,
  getConfigDir
} from '../lib/file-utils.js'

const NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const CACHE_FILE_NAME = 'nim-sync-cache.json'

export async function syncNIMModels(api: PluginAPI): Promise<{
  init?: () => Promise<void>,
  hooks?: Record<string, () => Promise<void>>,
  // Expose private functions for testing
  getAPIKey?: () => Promise<string | null>,
  updateConfig?: (models: NIMModel[]) => Promise<boolean>,
  refreshModels?: (force?: boolean) => Promise<void>
}> {
  let refreshInProgress = false
  
  const getCachePath = (): string => {
    return `${getConfigDir()}/${CACHE_FILE_NAME}`
  }

  const getConfigPath = (): string => {
    return `${getConfigDir()}/opencode.jsonc`
  }

  const readCache = async (): Promise<CacheData | null> => {
    try {
      return await readJSONC<CacheData>(getCachePath())
    } catch {
      return null
    }
  }

const writeCache = async (cache: CacheData): Promise<void> => {
  try {
    const releaseLock = await acquireLock('nim-cache-write')
    await writeJSONC(getCachePath(), cache, { backup: true })
    await releaseLock()
  } catch (error) {
    console.error('Failed to write cache:', error)
    api.tui.toast.show({
      title: 'NVIDIA Sync Failed',
      description: 'Failed to write cache: ' + (error instanceof Error ? error.message : 'Unknown error'),
      variant: 'error'
    })
    throw error // Re-throw to propagate the error
  }
}

const getAuthPath = (): string => {
  const homeDir = process.env.HOME || process.env.USERPROFILE || ''
  if (process.platform === 'win32') {
    return path.join(homeDir, 'AppData', 'Roaming', 'opencode', 'auth.json')
  }
  // Linux/macOS
  return path.join(homeDir, '.local', 'share', 'opencode', 'auth.json')
}

const getAPIKey = async (): Promise<string | null> => {
  try {
    const authPath = getAuthPath()
    const auth = await readJSONC<any>(authPath)

    if (Object.keys(auth).length === 0) {
      return process.env.NVIDIA_API_KEY || null
    }

    // Validate auth structure safely
    if (auth.credentials?.nim?.apiKey) {
      return auth.credentials.nim.apiKey
    }
    return process.env.NVIDIA_API_KEY || null
  } catch (error) {
    console.error('Failed to read auth.json:', error)
    return process.env.NVIDIA_API_KEY || null
  }
}

// Expose for testing
const exposedGetAPIKey = getAPIKey

interface NVIDIAApiResponse {
  data: NIMModel[]
}

const fetchModels = async (apiKey: string): Promise<NIMModel[]> => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

  try {
    const response = await fetch(`${NIM_BASE_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`NVIDIA API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as NVIDIAApiResponse
    return data.data || []
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('NVIDIA API request timed out after 30 seconds')
    }
    throw error
  }
}

const hashModels = (models: NIMModel[]): string => {
  const hash = crypto.createHash('sha256')
  // Sort by ID to ensure consistent hashing
  const sortedModels = [...models].sort((a, b) => a.id.localeCompare(b.id))
  hash.update(JSON.stringify(sortedModels))
  return hash.digest('hex')
}

  const shouldRefresh = async (): Promise<boolean> => {
    const config = api.config.get<OpenCodeConfig>()
    
    if (!(config as any)?.provider?.nim) {
      return true
    }

    const cache = await readCache()
    if (!cache || !cache.lastRefresh) {
      return true
    }

    const now = Date.now()
    if (now - cache.lastRefresh > CACHE_TTL_MS) {
      return true
    }

    return false
  }

const updateConfig = async (models: NIMModel[]): Promise<boolean> => {
  const config = await readJSONC<OpenCodeConfig>(getConfigPath())

  const newModels = models.reduce((acc, model) => {
    const existingOptions = config?.provider?.nim?.models?.[model.id]?.options || {}
    acc[model.id] = {
      name: model.name,
      options: existingOptions
    }
    return acc
  }, {} as Record<string, { name: string; options: Record<string, unknown> }>)

  const modelsHash = hashModels(models)
  const cache = await readCache()

  if (cache?.modelsHash === modelsHash) {
    return false
  }

  const releaseLock = await acquireLock('nim-config-update')
  try {
    // Deep merge provider.nim only, preserving other provider data
    const updatedConfig: OpenCodeConfig = {
      ...(config || {}),
      provider: {
        ...(config as any)?.provider,
        nim: {
          ...(config as any)?.provider?.nim,
          npm: '@ai-sdk/openai-compatible',
          name: 'NVIDIA NIM',
          options: {
            baseURL: NIM_BASE_URL
          },
          models: newModels
        }
      }
    }

    await writeJSONC(getConfigPath(), updatedConfig, {
      backup: true,
      createBackupDir: true
    })

    await writeCache({
      lastRefresh: Date.now(),
      modelsHash,
      baseURL: NIM_BASE_URL
    })

    return true
  } finally {
    await releaseLock()
  }
}

// Expose for testing
const exposedUpdateConfig = updateConfig

  const refreshModels = async (force = false): Promise<void> => {
    if (refreshInProgress) return
    refreshInProgress = true

    try {
      if (!force && !(await shouldRefresh())) {
        return
      }

      const apiKey = await getAPIKey()
      if (!apiKey) {
        api.tui.toast.show({
          title: 'NVIDIA API Key Required',
          description: 'Run /connect to add your NVIDIA API key',
          variant: 'error'
        })
        return
      }

      const models = await fetchModels(apiKey)
      const changed = await updateConfig(models)

      if (changed) {
        api.tui.toast.show({
          title: 'NVIDIA NIM Models Updated',
          description: `${models.length} models synchronized`,
          variant: 'success'
        })
      }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    api.tui.toast.show({
      title: 'NVIDIA Sync Failed',
      description: message,
      variant: 'error'
    })
      
      await writeCache({
        lastRefresh: Date.now(),
        modelsHash: '',
        lastError: message
      })
    } finally {
      refreshInProgress = false
    }
  }

const init = async (): Promise<void> => {
  await refreshModels() // Await to coordinate startup timing

  api.command.register('nim-refresh', async () => {
    await refreshModels(true)
  }, {
    description: 'Force refresh NVIDIA NIM models'
  })
}

  const hooks = {
    'server.connected': async () => {
      await refreshModels()
    },
    'session.created': async () => {
      await refreshModels()
    }
  }

return {
  init,
  hooks,
  // Expose private functions for testing
  getAPIKey: exposedGetAPIKey,
  updateConfig: exposedUpdateConfig,
  refreshModels
}
}

export default syncNIMModels