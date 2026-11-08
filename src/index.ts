import { fetchFullQuota, parseQuotaSummary } from './client.js';
import { detectConnection } from './detector.js';
import { formatCliTable } from './formatter.js';
import { buildHookOutput } from './hook.js';
import { HookInput } from './types.js';

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
async function handleHookMode(flags: { showAll?: boolean }): Promise<void> {
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
 * @param flags - CLI flags controlling verbosity, JSON formatting, and model filters.
 */
async function handleCliMode(flags: { verbose: boolean; json: boolean; filter?: string }): Promise<void> {
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
    const table = formatCliTable(summary, flags.verbose, isTty, flags.filter);
    console.log(table);
  } catch (err) {
    console.error(`❌ Error fetching quota: ${(err as Error).message}`);
    process.exit(1);
  }
}

const VERSION = '0.0.1';

function printHelp(): void {
  console.log(`
agq-hud - Antigravity AI Model Quota HUD & CLI (v${VERSION})

USAGE:
  agq [OPTIONS] [FILTER]
  agq-hud [OPTIONS] [FILTER]

ARGUMENTS:
  [FILTER]       Filter models by name or family (e.g., 'flash', 'claude')

OPTIONS:
  --hook         Run in Lifecycle Hook mode (PreInvocation JSON contract)
  --all          Display all models in HUD (disables active model filter)
  -v, --verbose  Display all model sub-variants and detailed breakdown
  --json         Output quota summary in raw JSON format
  -V, --version  Show version number
  -h, --help     Show this help message

EXAMPLES:
  agq            Show concise quota summary table in terminal
  agq flash      Show quota for models matching 'flash'
  agq -v         Show detailed quota table with all variants
  agq --json     Get machine-readable quota data
`);
}

/**
 * Application entry point for agq CLI and lifecycle hook execution.
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--version') || args.includes('-V')) {
    console.log(`agq-hud v${VERSION}`);
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const showAll = args.includes('--all') || args.includes('-a');

  if (args.includes('--hook')) {
    await handleHookMode({ showAll });
    return;
  }

  const verbose = args.includes('-v') || args.includes('--verbose');
  const json = args.includes('--json');

  // Any non-flag positional argument is treated as a filter
  const filter = args.find((arg) => !arg.startsWith('-'));

  await handleCliMode({ verbose, json, filter });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
