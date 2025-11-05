/**
 * Application Configuration
 *
 * Default API keys for AssemblyAI and Claude.
 * These keys are embedded into the application at build time.
 */

export const config = {
  assemblyai: {
    apiKey: process.env.ASSEMBLYAI_API_KEY || '',
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY || '',
  },
} as const;

// Validation helper to ensure keys are configured
export function validateConfig(): { valid: boolean; missing: string[] } {
  const missing: string[] = [];

  if (!config.assemblyai.apiKey) {
    missing.push('ASSEMBLYAI_API_KEY');
  }

  if (!config.claude.apiKey) {
    missing.push('CLAUDE_API_KEY');
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}
