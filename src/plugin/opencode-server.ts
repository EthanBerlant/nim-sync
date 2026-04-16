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
    }
  }
}

const plugin: PluginModule = {
  server
}

export default plugin
