import fs from 'fs/promises'
import path from 'path'
import { parse as parseJSONC } from 'jsonc-parser'

export interface AtomicWriteOptions {
  backup?: boolean
  createBackupDir?: boolean
}

export async function readJSONC<T = unknown>(filePath: string): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const errors: any[] = []
    const result = parseJSONC(content, errors) as T

    if (errors.length > 0) {
      throw new Error(`JSONC parse errors: ${errors.map(e => e.error).join(', ')}`)
    }

    return result
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {} as T
    }
    throw error
  }
}

export async function writeJSONC<T = unknown>(
  filePath: string,
  data: T,
  options?: AtomicWriteOptions
): Promise<void> {
  const content = JSON.stringify(data, null, 2)
  await atomicWrite(filePath, content, options)
}

export async function atomicWrite(
  filePath: string,
  content: string,
  options: AtomicWriteOptions = {}
): Promise<void> {
  const dir = path.dirname(filePath)
  const tempPath = `${filePath}.${Date.now()}.tmp`

  try {
    await fs.mkdir(dir, { recursive: true })

if (options.backup) {
  try {
    const backupDir = path.join(dir, 'backups')
    if (options.createBackupDir) {
      await fs.mkdir(backupDir, { recursive: true })
    }

    const backupPath = path.join(backupDir, `${path.basename(filePath)}.${Date.now()}.bak`)
    await fs.copyFile(filePath, backupPath)
  } catch (error) {
    throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

    await fs.writeFile(tempPath, content, 'utf-8')
    await fs.rename(tempPath, filePath)
  } catch (error) {
    try {
      await fs.unlink(tempPath)
    } catch (error) {
      // Ignore temp file cleanup failures
    }
    throw error
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  }
}

export function getConfigDir(): string {
  const userProfile = process.env.USERPROFILE || process.env.HOME || ''
  return path.join(userProfile, '.config', 'opencode')
}

export function getCacheDir(): string {
  const userProfile = process.env.USERPROFILE || process.env.HOME || ''
  return path.join(userProfile, '.cache', 'opencode')
}

export async function acquireLock(lockName: string, timeoutMs = 5000): Promise<() => void> {
  const lockDir = getCacheDir()
  const lockPath = path.join(lockDir, `${lockName}.lock`)

  await ensureDir(lockDir)

  // Clean up stale locks (older than 24 hours)
  try {
    const stats = await fs.stat(lockPath)
    const staleThreshold = Date.now() - 24 * 60 * 60 * 1000
    if (stats.mtimeMs < staleThreshold) {
      await fs.unlink(lockPath)
    }
  } catch (error) {
    // Ignore if lock file doesn't exist
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error('Failed to clean up stale lock:', error)
    }
  }

  const startTime = Date.now()

  while (Date.now() - startTime < timeoutMs) {
    try {
      const fd = await fs.open(lockPath, 'wx')
      await fd.close()

      return async () => {
        try {
          await fs.unlink(lockPath)
        } catch (error) {
          // Ignore unlock failures
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  throw new Error(`Failed to acquire lock "${lockName}" after ${timeoutMs}ms`)
}
