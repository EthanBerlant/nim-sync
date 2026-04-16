import type { TuiPlugin, TuiPluginModule } from '@opencode-ai/plugin/tui'
import { createNIMSyncService } from './nim-sync-service.js'

const tui: TuiPlugin = async (api) => {
  const service = createNIMSyncService({
    showToast: ({ title, message, variant }) => {
      api.ui.toast({
        title,
        message,
        variant
      })
    }
  })

  api.command.register(() => [
    {
      title: 'Refresh NVIDIA NIM models',
      value: 'nim.refresh',
      description: 'Force a fresh NVIDIA model sync',
      category: 'Plugin',
      slash: {
        name: 'nim-refresh'
      },
      onSelect: () => {
        void service.manualRefresh()
      }
    }
  ])
}

const plugin: TuiPluginModule = {
  id: 'nim-sync',
  tui
}

export default plugin
