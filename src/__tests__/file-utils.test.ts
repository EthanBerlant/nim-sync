import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs/promises'
import {
  readJSONC,
  writeJSONC,
  atomicWrite,
  ensureDir,
  getConfigDir,
  getCacheDir,
  acquireLock
} from '../lib/file-utils.js'

vi.mock('fs/promises')

describe('File Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.USERPROFILE = '/test/user'
    process.env.HOME = '/test/user'
  })

  describe('readJSONC', () => {
    it('reads and parses JSONC file', async () => {
      const mockContent = '{ "key": "value" }'
      vi.mocked(fs.readFile).mockResolvedValue(mockContent)

      const result = await readJSONC('/test/file.json')
      expect(result).toEqual({ key: 'value' })
    })

    it('returns empty object for ENOENT error', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException
      error.code = 'ENOENT'
      vi.mocked(fs.readFile).mockRejectedValue(error)

      const result = await readJSONC('/test/missing.json')
      expect(result).toEqual({})
    })

    it('throws error for other read failures', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Permission denied'))

      await expect(readJSONC('/test/file.json')).rejects.toThrow('Permission denied')
    })
  })

  describe('writeJSONC', () => {
    it('writes JSON data to file', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      vi.mocked(fs.rename).mockResolvedValue(undefined)

      await writeJSONC('/test/file.json', { key: 'value' })

      expect(fs.writeFile).toHaveBeenCalled()
    })
  })

  describe('atomicWrite', () => {
    it('writes file atomically', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      vi.mocked(fs.rename).mockResolvedValue(undefined)

      await atomicWrite('/test/file.txt', 'content')

      expect(fs.mkdir).toHaveBeenCalled()
      expect(fs.writeFile).toHaveBeenCalled()
      expect(fs.rename).toHaveBeenCalled()
    })

    it('creates backup when requested', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      vi.mocked(fs.rename).mockResolvedValue(undefined)
      vi.mocked(fs.copyFile).mockResolvedValue(undefined)

      await atomicWrite('/test/file.txt', 'content', { backup: true, createBackupDir: true })

      expect(fs.mkdir).toHaveBeenCalled()
    })

    it('cleans up temp file on error', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Write failed'))
      vi.mocked(fs.unlink).mockResolvedValue(undefined)

      await expect(atomicWrite('/test/file.txt', 'content')).rejects.toThrow('Write failed')
      expect(fs.unlink).toHaveBeenCalled()
    })
  })

  describe('ensureDir', () => {
    it('creates directory recursively', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)

      await ensureDir('/test/dir')

      expect(fs.mkdir).toHaveBeenCalledWith('/test/dir', { recursive: true })
    })

    it('ignores EEXIST error', async () => {
      const error = new Error('Directory exists') as NodeJS.ErrnoException
      error.code = 'EEXIST'
      vi.mocked(fs.mkdir).mockRejectedValue(error)

      await expect(ensureDir('/test/dir')).resolves.toBeUndefined()
    })

    it('throws other errors', async () => {
      vi.mocked(fs.mkdir).mockRejectedValue(new Error('Permission denied'))

      await expect(ensureDir('/test/dir')).rejects.toThrow('Permission denied')
    })
  })

  describe('getConfigDir', () => {
    it('returns config directory path', () => {
      const dir = getConfigDir()
      expect(dir).toContain('.config')
      expect(dir).toContain('opencode')
    })
  })

  describe('getCacheDir', () => {
    it('returns cache directory path', () => {
      const dir = getCacheDir()
      expect(dir).toContain('.cache')
      expect(dir).toContain('opencode')
    })
  })

  describe('acquireLock', () => {
    it('acquires lock successfully', async () => {
      const mockFd = { close: vi.fn().mockResolvedValue(undefined) }
      vi.mocked(fs.open).mockResolvedValue(mockFd as any)
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.unlink).mockResolvedValue(undefined)

      const release = await acquireLock('test-lock')
      expect(typeof release).toBe('function')

      // Release the lock
      await release()
      expect(fs.unlink).toHaveBeenCalled()
    })

    it('retries on EEXIST and eventually succeeds', async () => {
      const mockFd = { close: vi.fn().mockResolvedValue(undefined) }
      const error = new Error('Lock exists') as NodeJS.ErrnoException
      error.code = 'EEXIST'
      
      vi.mocked(fs.open)
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockFd as any)
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)
      vi.mocked(fs.unlink).mockResolvedValue(undefined)

      const release = await acquireLock('test-lock')
      expect(typeof release).toBe('function')
    })

    it('throws after timeout', async () => {
      const error = new Error('Lock exists') as NodeJS.ErrnoException
      error.code = 'EEXIST'
      
      vi.mocked(fs.open).mockRejectedValue(error)
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)

      await expect(acquireLock('test-lock', 100)).rejects.toThrow('Failed to acquire lock')
    })

    it('throws non-EEXIST errors immediately', async () => {
      vi.mocked(fs.open).mockRejectedValue(new Error('Permission denied'))
      vi.mocked(fs.mkdir).mockResolvedValue(undefined)

      await expect(acquireLock('test-lock')).rejects.toThrow('Permission denied')
    })
  })
})
