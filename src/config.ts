import fs from 'fs';
import os from 'os';
import path from 'path';
import { AgqConfig, SignalMode } from './types.js';

export const DEFAULT_SIGNAL_MODE: SignalMode = 'smart';

/**
 * Returns the default path for the user configuration file (~/.gemini/config/agq-hud.json).
 */
export function getDefaultConfigPath(): string {
  return path.join(os.homedir(), '.gemini', 'config', 'agq-hud.json');
}

/**
 * Normalizes and validates a raw signal mode string.
 * Returns undefined if the value is missing or invalid.
 */
export function parseSignalMode(raw?: unknown): SignalMode | undefined {
  if (typeof raw !== 'string') return undefined;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'smart' || normalized === 'threshold') {
    return normalized;
  }
  return undefined;
}

/**
 * Reads and parses the JSON config file safely.
 * Returns an empty config object when the file does not exist or cannot be parsed.
 */
export function loadConfig(configPath: string = getDefaultConfigPath()): AgqConfig {
  try {
    if (!fs.existsSync(configPath)) {
      return {};
    }
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const config: AgqConfig = {};
    const parsedMode = parseSignalMode(parsed.signalMode);
    if (parsedMode) {
      config.signalMode = parsedMode;
    }
    return config;
  } catch {
    return {};
  }
}

export interface ResolveSignalModeOptions {
  cliMode?: string;
  envMode?: string;
  configPath?: string;
}

/**
 * Resolves the effective signal mode using the precedence:
 * CLI flag (--signal) > environment variable (AGQ_SIGNAL_MODE) > config file > default ('smart').
 */
export function resolveSignalMode(options?: ResolveSignalModeOptions): SignalMode {
  const fromCli = parseSignalMode(options?.cliMode);
  if (fromCli) return fromCli;

  const envRaw = options?.envMode !== undefined ? options.envMode : process.env.AGQ_SIGNAL_MODE;
  const fromEnv = parseSignalMode(envRaw);
  if (fromEnv) return fromEnv;

  const config = loadConfig(options?.configPath);
  if (config.signalMode) return config.signalMode;

  return DEFAULT_SIGNAL_MODE;
}
