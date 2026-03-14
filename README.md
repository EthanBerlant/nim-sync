# OpenCode NVIDIA NIM Sync Plugin

A global OpenCode plugin that automatically synchronizes NVIDIA NIM models with your OpenCode configuration on startup.

## Features

- **Automatic Sync**: On OpenCode startup, fetches the latest NVIDIA model catalog
- **Config Management**: Updates `provider.nim.models` in your OpenCode config
- **TTL Cache**: Only refreshes models if last refresh was >24 hours ago
- **Manual Refresh**: `/nim-refresh` command for force updates
- **Atomic Operations**: Safe file writes with backups and locking
- **Error Handling**: Graceful fallback when offline or missing API key

## Installation

1. Clone or copy this plugin to your global OpenCode plugins directory:

```bash
# Windows
cp nim-sync.ts %USERPROFILE%/.config/opencode/plugins/

# Linux/macOS
cp nim-sync.ts ~/.config/opencode/plugins/
```

2. Ensure you have an NVIDIA API key either:
   - Set `NVIDIA_API_KEY` environment variable
   - Run `/connect` in OpenCode to add NVIDIA credentials

## Configuration

The plugin manages this subtree in your OpenCode config:

```json
{
  "provider": {
    "nim": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "NVIDIA NIM",
      "options": {
        "baseURL": "https://integrate.api.nvidia.com/v1"
      },
      "models": {
        "meta/llama-3.1-70b-instruct": {
          "name": "Meta Llama 3.1 70B Instruct"
        }
      }
    }
  }
}
```

## User Ownership

The plugin ONLY manages:
- `provider.nim.npm`
- `provider.nim.name`
- `provider.nim.options.baseURL`
- `provider.nim.models`

You retain control over:
- Top-level `model` selection
- `small_model` setting
- Per-model option overrides
- Any unrelated providers

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build TypeScript
npm run build

# Type check
npm run typecheck

# Lint
npm run lint
```

## Test-Driven Development

This project follows strict TDD principles:

1. **Tests First**: All functionality has failing tests written first
2. **80%+ Coverage**: Unit, integration, and user journey tests
3. **User Journeys**: Tests based on actual user scenarios
4. **Red-Green-Refactor**: Standard TDD workflow

## Architecture

### File Structure
```
src/
├── index.ts                 # Plugin entry point
├── plugin/nim-sync.ts       # Main plugin implementation
├── lib/file-utils.ts        # File operations with JSONC support
├── types/index.ts          # TypeScript definitions
└── __tests__/              # Test suites
```

### Key Components
- **Plugin Initialization**: Runs async refresh on OpenCode startup
- **Credential Resolution**: Checks `/connect` auth or env var
- **NVIDIA API Client**: Fetches `/v1/models` endpoint
- **Config Management**: Atomically updates OpenCode config
- **Cache System**: 24-hour TTL to avoid excessive API calls

## License

MIT