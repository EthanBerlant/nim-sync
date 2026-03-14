import fs from 'fs/promises';
import path from 'path';
import { parse as parseJSONC } from 'jsonc-parser';
export async function readJSONC(filePath) {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        const errors = [];
        const result = parseJSONC(content, errors);
        if (errors.length > 0) {
            throw new Error(`JSONC parse errors: ${errors.map(e => e.error).join(', ')}`);
        }
        return result;
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            return {};
        }
        throw error;
    }
}
export async function writeJSONC(filePath, data, options) {
    const content = JSON.stringify(data, null, 2);
    await atomicWrite(filePath, content, options);
}
export async function atomicWrite(filePath, content, options = {}) {
    const dir = path.dirname(filePath);
    const tempPath = `${filePath}.${Date.now()}.tmp`;
    try {
        await fs.mkdir(dir, { recursive: true });
        if (options.backup) {
            try {
                const backupDir = path.join(dir, 'backups');
                if (options.createBackupDir) {
                    await fs.mkdir(backupDir, { recursive: true });
                }
                const backupPath = path.join(backupDir, `${path.basename(filePath)}.${Date.now()}.bak`);
                await fs.copyFile(filePath, backupPath);
            }
            catch (error) {
                // Ignore backup failures
            }
        }
        await fs.writeFile(tempPath, content, 'utf-8');
        await fs.rename(tempPath, filePath);
    }
    catch (error) {
        try {
            await fs.unlink(tempPath);
        }
        catch (error) {
            // Ignore temp file cleanup failures
        }
        throw error;
    }
}
export async function ensureDir(dirPath) {
    try {
        await fs.mkdir(dirPath, { recursive: true });
    }
    catch (error) {
        if (error.code !== 'EEXIST') {
            throw error;
        }
    }
}
export function getConfigDir() {
    const userProfile = process.env.USERPROFILE || process.env.HOME || '';
    return path.join(userProfile, '.config', 'opencode');
}
export function getCacheDir() {
    const userProfile = process.env.USERPROFILE || process.env.HOME || '';
    return path.join(userProfile, '.cache', 'opencode');
}
export async function acquireLock(lockName, timeoutMs = 5000) {
    const lockDir = getCacheDir();
    const lockPath = path.join(lockDir, `${lockName}.lock`);
    await ensureDir(lockDir);
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        try {
            const fd = await fs.open(lockPath, 'wx');
            await fd.close();
            return async () => {
                try {
                    await fs.unlink(lockPath);
                }
                catch (error) {
                    // Ignore unlock failures
                }
            };
        }
        catch (error) {
            if (error.code !== 'EEXIST') {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    throw new Error(`Failed to acquire lock "${lockName}" after ${timeoutMs}ms`);
}
//# sourceMappingURL=file-utils.js.map