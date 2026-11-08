import { fetchUserStatus, parseQuotaSummary } from './client.js';
import { detectConnection } from './detector.js';
import { formatCliTable, formatHookMarkdown } from './formatter.js';
import { HookInput, HookPreInvocationOutput } from './types.js';

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

async function handleHookMode(): Promise<void> {
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

    const statusData = await fetchUserStatus(conn, 2500);
    const summary = parseQuotaSummary(statusData);
    const markdown = formatHookMarkdown(summary, hookInput.modelName);

    const output: HookPreInvocationOutput = {
      injectSteps: [
        {
          systemMessage: {
            systemMessage: '',
            metadata: {
              user_markdown: markdown,
            },
          },
        },
      ],
      terminationBehavior: '',
    };

    process.stdout.write(JSON.stringify(output) + '\n');
  } catch {
    // Failsafe: always output valid empty hook response on error
    process.stdout.write('{}\n');
  }
}

async function handleCliMode(flags: { verbose: boolean; json: boolean }): Promise<void> {
  try {
    const conn = await detectConnection();
    if (!conn) {
      console.error('❌ Could not connect to Antigravity Language Server.');
      console.error('   Please ensure Antigravity 2.0 / CLI / IDE is currently running.');
      process.exit(1);
    }

    const statusData = await fetchUserStatus(conn, 4000);
    const summary = parseQuotaSummary(statusData);

    if (flags.json) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const isTty = process.stdout.isTTY ?? true;
    const table = formatCliTable(summary, flags.verbose, isTty);
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
  agq [OPTIONS]
  agq-hud [OPTIONS]

OPTIONS:
  --hook         Run in Lifecycle Hook mode (PreInvocation JSON contract)
  -v, --verbose  Display all model sub-variants and detailed breakdown
  --json         Output quota summary in raw JSON format
  -V, --version  Show version number
  -h, --help     Show this help message

EXAMPLES:
  agq            Show concise quota summary table in terminal
  agq -v         Show detailed quota table with all variants
  agq --json     Get machine-readable quota data
`);
}

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

  if (args.includes('--hook')) {
    await handleHookMode();
    return;
  }

  const verbose = args.includes('-v') || args.includes('--verbose');
  const json = args.includes('--json');

  await handleCliMode({ verbose, json });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
