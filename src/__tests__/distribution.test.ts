import fs from 'fs/promises'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('distribution metadata', () => {
  it('publishes separate OpenCode server and TUI entrypoints', async () => {
    const packageJson = JSON.parse(
      await fs.readFile(path.join(process.cwd(), 'package.json'), 'utf-8')
    ) as {
      name?: string
      main?: string
      exports?: Record<string, unknown>
      files?: string[]
      scripts?: Record<string, string>
    }

    expect(packageJson.name).toBe('nim-sync')
    expect(packageJson.main).toBe('dist/server.mjs')
    expect(packageJson.exports).toMatchObject({
      '.': {
        import: './dist/server.mjs'
      },
      './server': {
        import: './dist/server.mjs'
      },
      './tui': {
        import: './dist/tui.mjs'
      }
    })
    expect(packageJson.files).toEqual(
      expect.arrayContaining(['dist', 'README.md'])
    )
    expect(packageJson.scripts?.prepack).toBe('npm run build')
  })

  it('documents the supported install path without migration guidance', async () => {
    const readme = await fs.readFile(path.join(process.cwd(), 'README.md'), 'utf-8')

    expect(readme).toContain('opencode plugin nim-sync -g')
    expect(readme).toContain('/nim-refresh')
    expect(readme).toContain('You do not need to edit `opencode.json` manually')
    expect(readme).not.toContain('tui.json')
    expect(readme).not.toContain('Restart OpenCode one more time')
    expect(readme).not.toContain('Copy-Item dist/nim-sync.mjs')
    expect(readme).not.toContain('cp dist/nim-sync.mjs')
  })
})
