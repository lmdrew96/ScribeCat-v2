/**
 * Application Configuration
 *
 * Default API keys for AssemblyAI and Claude.
 * In main process: loaded via dotenv from .env file
 * In renderer process: injected at build time via esbuild define
 */

export const config = {
  assemblyai: {
    apiKey: process.env.ASSEMBLYAI_API_KEY || '',
  },
  claude: {
    apiKey: process.env.CLAUDE_API_KEY || '',
  },
  googleDrive: {
    clientId: process.env.GOOGLE_DRIVE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET || '',
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
