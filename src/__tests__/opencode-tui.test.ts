import { beforeEach, describe, expect, it, vi } from "vitest";

const manualRefresh = vi.fn();

vi.mock("../plugin/nim-sync-service.js", () => ({
  createNIMSyncService: vi.fn(() => ({
    manualRefresh,
  })),
}));

import plugin from "../plugin/opencode-tui.js";

type RegisteredCommand = {
  value: string;
  hidden?: boolean;
  keybind?: string;
  slash?: {
    name: string;
  };
  onSelect?: () => void;
};

type PromptRefLike = {
  focused: boolean;
  current: {
    input: string;
    parts: unknown[];
  };
  set: ReturnType<typeof vi.fn>;
  reset: ReturnType<typeof vi.fn>;
  blur: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  submit: ReturnType<typeof vi.fn>;
};

const createPromptRef = (input: string): PromptRefLike => ({
  focused: true,
  current: {
    input,
    parts: [],
  },
  set: vi.fn(),
  reset: vi.fn(),
  blur: vi.fn(),
  focus: vi.fn(),
  submit: vi.fn(),
});

const pluginMeta = {
  state: "same" as const,
  id: "nim-sync",
  source: "npm" as const,
  spec: "nim-sync",
  target: "file:///nim-sync",
  first_time: Date.now(),
  last_time: Date.now(),
  time_changed: Date.now(),
  load_count: 1,
  fingerprint: "nim-sync:tui",
};

const initializeTuiPlugin = async () => {
  const commandFactories: Array<() => RegisteredCommand[]> = [];
  const promptCalls: Array<Record<string, unknown>> = [];
  let slotRegistration:
    | {
        slots: Record<
          string,
          (ctx: unknown, props: Record<string, unknown>) => unknown
        >;
      }
    | undefined;

  const api = {
    command: {
      register: vi.fn((cb: () => RegisteredCommand[]) => {
        commandFactories.push(cb);
        return () => {};
      }),
    },
    slots: {
      register: vi.fn(
        (registration: {
          slots: Record<
            string,
            (ctx: unknown, props: Record<string, unknown>) => unknown
          >;
        }) => {
          slotRegistration = registration;
          return "nim-sync";
        },
      ),
    },
    ui: {
      toast: vi.fn(),
      Prompt: vi.fn((props: Record<string, unknown>) => {
        promptCalls.push(props);
        return { type: "Prompt", props };
      }),
      Slot: vi.fn((props: Record<string, unknown>) => ({
        type: "Slot",
        props,
      })),
    },
  };

  await plugin.tui(api as any, undefined, pluginMeta);

  return {
    api,
    promptCalls,
    commands: () => commandFactories.flatMap((factory) => factory()),
    slotRegistration: () => slotRegistration,
  };
};

describe("official TUI plugin", () => {
  beforeEach(() => {
    manualRefresh.mockReset();
  });

  it("exposes a stable plugin id", () => {
    expect(plugin.id).toBe("nim-sync");
  });

  it("registers /nim-refresh as a slash command for autocomplete", async () => {
    const runtime = await initializeTuiPlugin();

    expect(runtime.commands()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "nim.refresh",
          slash: {
            name: "nim-refresh",
          },
        }),
      ]),
    );
  });

  it("runs a manual refresh when the command is selected", async () => {
    const runtime = await initializeTuiPlugin();

    const refreshCommand = runtime
      .commands()
      .find((command) => command.value === "nim.refresh");

    refreshCommand?.onSelect?.();

    expect(manualRefresh).toHaveBeenCalledTimes(1);
  });

  it("wraps the host prompts and overrides prompt.submit for local /nim-refresh handling", async () => {
    const runtime = await initializeTuiPlugin();

    expect(runtime.slotRegistration()).toMatchObject({
      slots: expect.objectContaining({
        home_prompt: expect.any(Function),
        session_prompt: expect.any(Function),
      }),
    });

    const submitCommand = runtime
      .commands()
      .find((command) => command.value === "prompt.submit");
    expect(submitCommand).toMatchObject({
      hidden: true,
      keybind: "input_submit",
    });

    const promptRef = createPromptRef("/nim-refresh");
    const forwardedRef = vi.fn();

    runtime.slotRegistration()?.slots.session_prompt?.(
      {},
      {
        session_id: "session-1",
        visible: true,
        disabled: false,
        on_submit: vi.fn(),
        ref: forwardedRef,
      },
    );

    const promptProps = runtime.promptCalls.at(-1);
    expect(promptProps).toBeDefined();
    (
      promptProps?.ref as ((ref: PromptRefLike | undefined) => void) | undefined
    )?.(promptRef);

    submitCommand?.onSelect?.();
    await Promise.resolve();

    expect(manualRefresh).toHaveBeenCalledTimes(1);
    expect(promptRef.reset).toHaveBeenCalledTimes(1);
    expect(promptRef.submit).not.toHaveBeenCalled();
    expect(forwardedRef).toHaveBeenCalledWith(promptRef);
  });

  it("falls through to the host submit flow for non-refresh prompts", async () => {
    const runtime = await initializeTuiPlugin();
    const promptRef = createPromptRef("ship it");

    runtime.slotRegistration()?.slots.session_prompt?.(
      {},
      {
        session_id: "session-1",
        visible: true,
        disabled: false,
        on_submit: vi.fn(),
        ref: vi.fn(),
      },
    );

    const promptProps = runtime.promptCalls.at(-1);
    (
      promptProps?.ref as ((ref: PromptRefLike | undefined) => void) | undefined
    )?.(promptRef);

    runtime
      .commands()
      .find((command) => command.value === "prompt.submit")
      ?.onSelect?.();

    expect(promptRef.submit).toHaveBeenCalledTimes(1);
    expect(promptRef.reset).not.toHaveBeenCalled();
    expect(manualRefresh).not.toHaveBeenCalled();
  });
});
