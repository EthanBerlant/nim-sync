import crypto from 'crypto';
import path from 'path';
import { readJSONC, writeJSONC, acquireLock, getConfigDir } from '../lib/file-utils.js';
const NIM_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_FILE_NAME = 'nim-sync-cache.json';
export async function syncNIMModels(api) {
    let refreshInProgress = false;
    const getCachePath = () => {
        return `${getConfigDir()}/${CACHE_FILE_NAME}`;
    };
    const getConfigPath = () => {
        return `${getConfigDir()}/opencode.jsonc`;
    };
    const readCache = async () => {
        try {
            return await readJSONC(getCachePath());
        }
        catch {
            return null;
        }
    };
    const writeCache = async (cache) => {
        try {
            const releaseLock = await acquireLock('nim-cache-write');
            await writeJSONC(getCachePath(), cache, { backup: true });
            await releaseLock();
        }
        catch (error) {
            console.error('Failed to write cache:', error);
        }
    };
    const getAuthPath = () => {
        const homeDir = process.env.HOME || process.env.USERPROFILE || '';
        if (process.platform === 'win32') {
            return path.join(homeDir, 'AppData', 'Roaming', 'opencode', 'auth.json');
        }
        // Linux/macOS
        return path.join(homeDir, '.local', 'share', 'opencode', 'auth.json');
    };
    const getAPIKey = async () => {
        try {
            const authPath = getAuthPath();
            const auth = await readJSONC(authPath);
            if (Object.keys(auth).length === 0) {
                return process.env.NVIDIA_API_KEY || null;
            }
            return auth?.credentials?.nim?.apiKey || process.env.NVIDIA_API_KEY || null;
        }
        catch {
            return process.env.NVIDIA_API_KEY || null;
        }
    };
    const fetchModels = async (apiKey) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        try {
            const response = await fetch(`${NIM_BASE_URL}/models`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`NVIDIA API error: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            return data.data || [];
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('NVIDIA API request timed out after 30 seconds');
            }
            throw error;
        }
    };
    const hashModels = (models) => {
        const hash = crypto.createHash('sha256');
        // Sort by ID to ensure consistent hashing
        const sortedModels = [...models].sort((a, b) => a.id.localeCompare(b.id));
        hash.update(JSON.stringify(sortedModels));
        return hash.digest('hex');
    };
    const shouldRefresh = async () => {
        const config = api.config.get();
        if (!config?.provider?.nim) {
            return true;
        }
        const cache = await readCache();
        if (!cache || !cache.lastRefresh) {
            return true;
        }
        const now = Date.now();
        if (now - cache.lastRefresh > CACHE_TTL_MS) {
            return true;
        }
        return false;
    };
    const updateConfig = async (models) => {
        const config = await readJSONC(getConfigPath());
        const newModels = models.reduce((acc, model) => {
            const existingOptions = config?.provider?.nim?.models?.[model.id]?.options || {};
            acc[model.id] = {
                name: model.name,
                options: existingOptions
            };
            return acc;
        }, {});
        const modelsHash = hashModels(models);
        const cache = await readCache();
        if (cache?.modelsHash === modelsHash) {
            return false;
        }
        const releaseLock = await acquireLock('nim-config-update');
        try {
            const updatedConfig = {
                ...(config || {}),
                provider: {
                    ...config?.provider,
                    nim: {
                        npm: '@ai-sdk/openai-compatible',
                        name: 'NVIDIA NIM',
                        options: {
                            baseURL: NIM_BASE_URL
                        },
                        models: newModels
                    }
                }
            };
            await writeJSONC(getConfigPath(), updatedConfig, {
                backup: true,
                createBackupDir: true
            });
            await writeCache({
                lastRefresh: Date.now(),
                modelsHash,
                baseURL: NIM_BASE_URL
            });
            return true;
        }
        finally {
            await releaseLock();
        }
    };
    const refreshModels = async (force = false) => {
        if (refreshInProgress)
            return;
        refreshInProgress = true;
        try {
            if (!force && !(await shouldRefresh())) {
                return;
            }
            const apiKey = await getAPIKey();
            if (!apiKey) {
                api.tui.toast.show({
                    title: 'NVIDIA API Key Required',
                    description: 'Run /connect to add your NVIDIA API key',
                    variant: 'error'
                });
                return;
            }
            const models = await fetchModels(apiKey);
            const changed = await updateConfig(models);
            if (changed) {
                api.tui.toast.show({
                    title: 'NVIDIA NIM Models Updated',
                    description: `${models.length} models synchronized`,
                    variant: 'success'
                });
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            api.tui.toast.show({
                title: 'NVIDIA Sync Failed',
                description: message,
                variant: 'error'
            });
            await writeCache({
                lastRefresh: Date.now(),
                modelsHash: '',
                lastError: message
            });
        }
        finally {
            refreshInProgress = false;
        }
    };
    const init = async () => {
        setTimeout(() => refreshModels(), 100);
        api.command.register('nim-refresh', async () => {
            await refreshModels(true);
        }, {
            description: 'Force refresh NVIDIA NIM models'
        });
    };
    const hooks = {
        'server.connected': async () => {
            await refreshModels();
        },
        'session.created': async () => {
            await refreshModels();
        }
    };
    return {
        init,
        hooks
    };
}
export default syncNIMModels;
//# sourceMappingURL=nim-sync.js.map