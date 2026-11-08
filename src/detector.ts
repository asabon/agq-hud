import { execSync } from 'child_process';
import http from 'http';
import { ConnectionInfo } from './types.js';

/**
 * Checks if a candidate address and CSRF token respond to health check or GetUserStatus
 */
function probePort(port: number, csrfToken: string, timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/healthz',
        method: 'GET',
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          // If healthz is not 200, try GetUserStatus RPC
          probeRpc(port, csrfToken, timeoutMs).then(resolve);
        }
      }
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

function probeRpc(port: number, csrfToken: string, timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const postData = '{}';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-codeium-csrf-token': csrfToken,
          'Content-Length': Buffer.byteLength(postData),
        },
        timeout: timeoutMs,
      },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Find processes on Windows
 */
function findWindowsProcesses(): Array<{ pid: number; commandLine: string; csrfToken?: string }> {
  const results: Array<{ pid: number; commandLine: string; csrfToken?: string }> = [];
  try {
    const psCmd =
      'powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process -Filter \\"name like \'%language_server%\' or name like \'%agy%\'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json"';
    const output = execSync(psCmd, { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] });
    if (!output.trim()) return results;

    const parsed = JSON.parse(output);
    const items = Array.isArray(parsed) ? parsed : [parsed];

    for (const item of items) {
      if (!item || !item.ProcessId || !item.CommandLine) continue;
      const pid = Number(item.ProcessId);
      const commandLine = String(item.CommandLine);
      const tokenMatch = commandLine.match(/--csrf_token\s+([a-f0-9-]+)/i);
      results.push({
        pid,
        commandLine,
        csrfToken: tokenMatch ? tokenMatch[1] : undefined,
      });
    }
  } catch {
    // Fallback: try wmic
    try {
      const wmicOutput = execSync('wmic process where "name like \'%language_server%\'" get ProcessId,CommandLine /format:csv', {
        encoding: 'utf8',
        timeout: 3000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const lines = wmicOutput.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const match = line.match(/.*?,(.*?),(\d+)$/);
        if (match) {
          const commandLine = match[1];
          const pid = Number(match[2]);
          const tokenMatch = commandLine.match(/--csrf_token\s+([a-f0-9-]+)/i);
          results.push({
            pid,
            commandLine,
            csrfToken: tokenMatch ? tokenMatch[1] : undefined,
          });
        }
      }
    } catch {
      // Ignore
    }
  }
  return results;
}

/**
 * Find listening ports for a Windows PID
 */
function findWindowsListeningPorts(pid: number): number[] {
  const ports: number[] = [];
  try {
    const netstatOut = execSync(`netstat -ano | findstr "${pid}"`, {
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const lines = netstatOut.split(/\r?\n/);
    for (const line of lines) {
      if (line.includes('LISTENING') || line.includes('LISTENER')) {
        const portMatch = line.match(/(?:127\.0\.0\.1|0\.0\.0\.0|\[::\]):(\d+)\s+/);
        if (portMatch) {
          const p = Number(portMatch[1]);
          if (!ports.includes(p)) {
            ports.push(p);
          }
        }
      }
    }
  } catch {
    // Ignore
  }
  return ports;
}

/**
 * Find processes on Unix (macOS / Linux)
 */
function findUnixProcesses(): Array<{ pid: number; commandLine: string; csrfToken?: string }> {
  const results: Array<{ pid: number; commandLine: string; csrfToken?: string }> = [];
  try {
    const psOut = execSync('ps -eo pid,command', {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const lines = psOut.split(/\n/);
    for (const line of lines) {
      if (line.includes('language_server') && !line.includes('grep')) {
        const match = line.trim().match(/^(\d+)\s+(.+)$/);
        if (match) {
          const pid = Number(match[1]);
          const commandLine = match[2];
          const tokenMatch = commandLine.match(/--csrf_token\s+([a-f0-9-]+)/i);
          results.push({
            pid,
            commandLine,
            csrfToken: tokenMatch ? tokenMatch[1] : undefined,
          });
        }
      }
    }
  } catch {
    // Ignore
  }
  return results;
}

/**
 * Find listening ports for a Unix PID
 */
function findUnixListeningPorts(pid: number): number[] {
  const ports: number[] = [];
  try {
    const lsofOut = execSync(`lsof -iTCP -sTCP:LISTEN -n -P -p ${pid} 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const lines = lsofOut.split(/\n/);
    for (const line of lines) {
      const match = line.match(/:(\d+)\s+\(LISTEN\)/i);
      if (match) {
        const p = Number(match[1]);
        if (!ports.includes(p)) {
          ports.push(p);
        }
      }
    }
  } catch {
    // Fallback: try ss
    try {
      const ssOut = execSync(`ss -tlnp 2>/dev/null | grep "${pid}"`, {
        encoding: 'utf8',
        timeout: 2000,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      const lines = ssOut.split(/\n/);
      for (const line of lines) {
        const match = line.match(/:(\d+)\s+/);
        if (match) {
          const p = Number(match[1]);
          if (!ports.includes(p)) {
            ports.push(p);
          }
        }
      }
    } catch {
      // Ignore
    }
  }
  return ports;
}

/**
 * Detect connection info to Antigravity Language Server
 */
export async function detectConnection(): Promise<ConnectionInfo | null> {
  // 1. Direct environment variables
  const envAddress = process.env.ANTIGRAVITY_LS_ADDRESS;
  const envToken = process.env.ANTIGRAVITY_CSRF_TOKEN;

  if (envAddress && envToken) {
    return {
      address: envAddress,
      csrfToken: envToken,
      source: 'env',
    };
  }

  // 2. Fallback process search
  const isWin = process.platform === 'win32';
  const procs = isWin ? findWindowsProcesses() : findUnixProcesses();

  for (const proc of procs) {
    if (!proc.csrfToken) continue;

    const ports = isWin ? findWindowsListeningPorts(proc.pid) : findUnixListeningPorts(proc.pid);

    for (const port of ports) {
      const ok = await probePort(port, proc.csrfToken);
      if (ok) {
        return {
          address: `localhost:${port}`,
          csrfToken: proc.csrfToken,
          source: 'process',
        };
      }
    }
  }

  return null;
}
