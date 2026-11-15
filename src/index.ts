import { fetchFullQuota, parseQuotaSummary } from './client.js';
import { parseSignalMode, resolveSignalMode } from './config.js';
import { detectConnection } from './detector.js';
import { formatCliTable } from './formatter.js';
import { buildHookOutput } from './hook.js';
import { HookInput, SignalMode } from './types.js';

export { buildHookOutput };

/**
 * Reads all data from standard input until EOF.
 *
 * @returns Resolves with the collected string data.
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');

    // If stdin is a TTY, don't wait for input
    if (process.stdin.isTTY) {
      resolve('');
      return;
    }

    // Timeout safety for reading stdin
    const timeout = setTimeout(() => {
      resolve(data);
    }, 1000);

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      clearTimeout(timeout);
      resolve(data);
    });

    process.stdin.on('error', () => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}


/**
 * Handles Antigravity PreInvocation lifecycle hook mode.
 * Reads hook input from stdin, retrieves model quota data,
 * and outputs HookPreInvocationOutput JSON with systemMessage and renderInfo.
 *
 * @param flags - Command line flags controlling hook display options.
 */
async function handleHookMode(flags: { showAll?: boolean; signalMode: SignalMode }): Promise<void> {
  try {
    const rawInput = await readStdin();
    let hookInput: HookInput = {};
    if (rawInput.trim()) {
      try {
        hookInput = JSON.parse(rawInput);
      } catch {
        // Ignore JSON parse error on stdin
      }
    }

    const conn = await detectConnection();
    if (!conn) {
      // Gracefully exit without breaking conversation turn
      process.stdout.write('{}\n');
      return;
    }

    const { statusData, quotaSummaryData } = await fetchFullQuota(conn, 2500);
    const summary = parseQuotaSummary(statusData, quotaSummaryData);
    const output = buildHookOutput(summary, hookInput.modelName, {
      forceAll: flags.showAll,
      signalMode: flags.signalMode,
    });

    process.stdout.write(JSON.stringify(output) + '\n');
  } catch {
    // Failsafe: always output valid empty hook response on error
    process.stdout.write('{}\n');
  }
}

/**
 * Handles standalone CLI execution mode, displaying quota tables or JSON output.
 *
 * @param flags - CLI flags controlling verbosity, JSON formatting, signal mode, and model filters.
 */
async function handleCliMode(flags: {
  verbose: boolean;
  json: boolean;
  filter?: string;
  signalMode: SignalMode;
}): Promise<void> {
  try {
    const conn = await detectConnection();
    if (!conn) {
      console.error('❌ Could not connect to Antigravity Language Server.');
      console.error('   Please ensure Antigravity 2.0 / CLI / IDE is currently running.');
      process.exit(1);
    }

    const { statusData, quotaSummaryData } = await fetchFullQuota(conn, 4000);
    const summary = parseQuotaSummary(statusData, quotaSummaryData);

    if (flags.json) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const isTty = process.stdout.isTTY ?? true;
    const table = formatCliTable(summary, flags.verbose, isTty, flags.filter, flags.signalMode);
    console.log(table);
  } catch (err) {
    console.error(`❌ Error fetching quota: ${(err as Error).message}`);
    process.exit(1);
  }
}

const VERSION = '0.1.0';

function printHelp(): void {
  console.log(`
agq-hud - Antigravity AI Model Quota HUD & CLI (v${VERSION})

USAGE:
  agq-hud [OPTIONS] [FILTER]

ARGUMENTS:
  [FILTER]               Filter models by name or family (e.g., 'flash', 'claude')

OPTIONS:
  --hook                 Run in Lifecycle Hook mode (PreInvocation JSON contract)
  --all                  Display all models in HUD (disables active model filter)
  --signal <mode>        Signal display mode: 'smart' (default) or 'threshold'
  -v, --verbose          Display all model sub-variants and detailed breakdown
  --json                 Output quota summary in raw JSON format
  -V, --version          Show version number
  -h, --help             Show this help message

CONFIGURATION:
  Precedence: --signal > AGQ_SIGNAL_MODE > ~/.gemini/config/agq-hud.json > 'smart'

EXAMPLES:
  agq-hud                    Show concise quota summary table in terminal
  agq-hud --signal threshold Use fixed percentage thresholds instead of smart mode
  agq-hud flash              Show quota for models matching 'flash'
  agq-hud -v                 Show detailed quota table with all variants
  agq-hud --json             Get machine-readable quota data
`);
}

interface ParsedArgs {
  showVersion: boolean;
  showHelp: boolean;
  hook: boolean;
  showAll: boolean;
  verbose: boolean;
  json: boolean;
  signalRaw?: string;
  signalMissingValue: boolean;
  filter?: string;
}

function parseCliArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    showVersion: false,
    showHelp: false,
    hook: false,
    showAll: false,
    verbose: false,
    json: false,
    signalMissingValue: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--version' || arg === '-V') {
      parsed.showVersion = true;
    } else if (arg === '--help' || arg === '-h') {
      parsed.showHelp = true;
    } else if (arg === '--hook') {
      parsed.hook = true;
    } else if (arg === '--all' || arg === '-a') {
      parsed.showAll = true;
    } else if (arg === '-v' || arg === '--verbose') {
      parsed.verbose = true;
    } else if (arg === '--json') {
      parsed.json = true;
    } else if (arg === '--signal') {
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        parsed.signalRaw = next;
        i++;
      } else {
        parsed.signalMissingValue = true;
      }
    } else if (arg.startsWith('--signal=')) {
      parsed.signalRaw = arg.slice('--signal='.length);
    } else if (!arg.startsWith('-') && parsed.filter === undefined) {
      parsed.filter = arg;
    }
  }

  return parsed;
}

/**
 * Application entry point for agq-hud CLI and lifecycle hook execution.
 */
async function main(): Promise<void> {
  const parsed = parseCliArgs(process.argv.slice(2));

  if (parsed.showVersion) {
    console.log(`agq-hud v${VERSION}`);
    return;
  }

  if (parsed.showHelp) {
    printHelp();
    return;
  }

  if (!parsed.hook && (parsed.signalMissingValue || (parsed.signalRaw !== undefined && !parseSignalMode(parsed.signalRaw)))) {
    const detail = parsed.signalMissingValue
      ? 'Missing value for --signal.'
      : `Invalid --signal value: "${parsed.signalRaw}".`;
    console.error(`❌ ${detail} Expected 'smart' or 'threshold'.`);
    process.exit(1);
  }

  const signalMode = resolveSignalMode({ cliMode: parsed.signalRaw });

  if (parsed.hook) {
    await handleHookMode({ showAll: parsed.showAll, signalMode });
    return;
  }

  await handleCliMode({
    verbose: parsed.verbose,
    json: parsed.json,
    filter: parsed.filter,
    signalMode,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
