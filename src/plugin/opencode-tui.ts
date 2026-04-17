import type { TuiPlugin, TuiPluginModule, TuiPromptRef } from '@opencode-ai/plugin/tui'
import {
  handlePromptSubmit,
  NIM_REFRESH_COMMAND_DESCRIPTION,
  NIM_REFRESH_COMMAND_NAME,
  NIM_REFRESH_TUI_COMMAND_VALUE,
  PROMPT_SUBMIT_COMMAND_VALUE
} from './nim-refresh-command.js'
import { createNIMSyncService } from './nim-sync-service.js'

type PromptRefHolder = {
  current: TuiPromptRef | undefined
}

type HomePromptSlotProps = {
  workspace_id?: string
  ref?: (ref: TuiPromptRef | undefined) => void
}

type SessionPromptSlotProps = {
  session_id: string
  visible?: boolean
  disabled?: boolean
  on_submit?: () => void
  ref?: (ref: TuiPromptRef | undefined) => void
}

const bindPromptRef = (
  holder: PromptRefHolder,
  forward?: (ref: TuiPromptRef | undefined) => void
): ((ref: TuiPromptRef | undefined) => void) => {
  let captured: TuiPromptRef | undefined

  return (ref) => {
    if (ref) {
      captured = ref
      holder.current = ref
    } else if (holder.current === captured) {
      holder.current = undefined
      captured = undefined
    }

    forward?.(ref)
  }
}

const tui: TuiPlugin = async (api) => {
  const promptRef: PromptRefHolder = { current: undefined }
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
      title: NIM_REFRESH_COMMAND_DESCRIPTION,
      value: NIM_REFRESH_TUI_COMMAND_VALUE,
      description: 'Force a fresh NVIDIA model sync',
      category: 'Plugin',
      slash: {
        name: NIM_REFRESH_COMMAND_NAME
      },
      onSelect: () => {
        void service.manualRefresh()
      }
    },
    {
      title: 'Submit prompt',
      value: PROMPT_SUBMIT_COMMAND_VALUE,
      keybind: 'input_submit',
      category: 'Prompt',
      hidden: true,
      onSelect: () => {
        void handlePromptSubmit(promptRef.current, service.manualRefresh)
      }
    }
  ])

  api.slots.register({
    order: 1000,
    slots: {
      home_prompt: (_ctx: unknown, props: HomePromptSlotProps) => api.ui.Prompt({
        ref: bindPromptRef(promptRef, props.ref),
        workspaceID: props.workspace_id,
        right: api.ui.Slot({
          name: 'home_prompt_right',
          workspace_id: props.workspace_id
        })
      }),
      session_prompt: (_ctx: unknown, props: SessionPromptSlotProps) => api.ui.Prompt({
        visible: props.visible,
        ref: bindPromptRef(promptRef, props.ref),
        disabled: props.disabled,
        onSubmit: props.on_submit,
        sessionID: props.session_id,
        right: api.ui.Slot({
          name: 'session_prompt_right',
          session_id: props.session_id
        })
      })
    }
  })
}

const plugin: TuiPluginModule = {
  id: 'nim-sync',
  tui
}

export default plugin
