import type { Plugin, PluginModule } from '@opencode-ai/plugin'
import { createNIMSyncService } from './nim-sync-service.js'

const server: Plugin = async (input) => {
  const service = createNIMSyncService({
    showToast: async ({ title, message, variant }) => {
      await input.client.tui.showToast({
        body: {
          title,
          message,
          variant
        }
      })
    }
  })

  return {
    event: async ({ event }) => {
      if (event.type === 'server.connected' || event.type === 'session.created') {
        await service.refreshModels()
      }
    },
    'command.execute.before': async ({ command }, output) => {
      if (command !== 'nim-refresh') {
        return
      }

      await service.manualRefresh()

      const textPart = output.parts.find(
        (part): part is typeof part & { type: 'text'; text: string } =>
          part.type === 'text' && typeof (part as { text?: unknown }).text === 'string'
      )

      if (textPart) {
        textPart.text = 'The /nim-refresh command was already handled by the nim-sync plugin. Reply with exactly: "NVIDIA NIM refresh complete."'
      }
    }
  }
}

const plugin: PluginModule = {
  id: 'nim-sync',
  server
}

export default plugin
