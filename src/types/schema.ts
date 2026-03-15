/**
 * JSON Schema for OpenCode configuration validation.
 * Validates the structure of opencode.jsonc files.
 */
export const OpenCodeConfigSchema = {
 $schema: 'http://json-schema.org/draft-07/schema#',
 $id: 'https://opencode.ai/schemas/opencode-config',
 title: 'OpenCode Configuration',
 description: 'Configuration schema for OpenCode plugins',
 type: 'object',
 additionalProperties: true,
  properties: {
    $schema: {
      type: 'string',
      description: 'JSON Schema URI'
    },
    provider: {
      type: 'object',
      additionalProperties: true,
      description: 'AI provider configurations',
      properties: {
        nim: {
          type: 'object',
          description: 'NVIDIA NIM provider configuration',
          properties: {
            npm: {
              type: 'string',
              description: 'NPM package name for the provider'
            },
            name: {
              type: 'string',
              description: 'Display name for the provider'
            },
            options: {
              type: 'object',
              additionalProperties: true,
              description: 'Provider-specific options',
              properties: {
                baseURL: {
                  type: 'string',
                  format: 'uri',
                  description: 'Base URL for the API'
                }
              }
            },
            models: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Model display name'
                  },
                  options: {
                    type: 'object',
                    additionalProperties: true,
                    description: 'Model-specific options'
                  }
                },
                required: ['name'],
                additionalProperties: false
              },
              description: 'Available models for this provider'
            }
          },
          required: ['npm', 'name'],
          additionalProperties: false
        }
      }
    },
    model: {
      type: 'string',
      description: 'Default model to use'
    },
    small_model: {
      type: 'string',
      description: 'Small model for lightweight tasks'
    }
  }
} as const

/**
 * Validates OpenCode configuration against schema.
 * 
 * @param config - Configuration object to validate
 * @returns Validation result with errors if any
 */
export function validateOpenCodeConfig(config: unknown): {
  valid: boolean
  errors?: string[]
} {
  if (typeof config !== 'object' || config === null) {
    return { valid: false, errors: ['Configuration must be an object'] }
  }

  const typedConfig = config as Record<string, unknown>
  const errors: string[] = []

  // Validate provider structure if present
  if (typedConfig.provider && typeof typedConfig.provider === 'object') {
    const provider = typedConfig.provider as Record<string, unknown>
    
    if (provider.nim && typeof provider.nim === 'object') {
      const nim = provider.nim as Record<string, unknown>
      
      // Check required fields
      if (typeof nim.npm !== 'string') {
        errors.push('provider.nim.npm must be a string')
      }
      if (typeof nim.name !== 'string') {
        errors.push('provider.nim.name must be a string')
      }
      
      // Validate models structure if present
      if (nim.models && typeof nim.models === 'object') {
        const models = nim.models as Record<string, unknown>
        for (const [modelId, modelData] of Object.entries(models)) {
          if (typeof modelData !== 'object' || modelData === null) {
            errors.push(`provider.nim.models.${modelId} must be an object`)
          } else {
            const model = modelData as Record<string, unknown>
            if (typeof model.name !== 'string') {
              errors.push(`provider.nim.models.${modelId}.name must be a string`)
            }
          }
        }
      }
    }
  }

  // Validate model fields
  if (typedConfig.model !== undefined && typeof typedConfig.model !== 'string') {
    errors.push('model must be a string if provided')
  }
  
  if (typedConfig.small_model !== undefined && typeof typedConfig.small_model !== 'string') {
    errors.push('small_model must be a string if provided')
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  }
}