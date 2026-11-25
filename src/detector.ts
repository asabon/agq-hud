import { execSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
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
      if ((line.includes('language_server') || /\bagy\b/.test(line)) && !line.includes('grep')) {
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

export interface HubDaemonInfo {
  csrfToken: string;
  ports: number[];
}

function getDefaultDaemonDir(): string {
  const appDataDir = process.env.ANTIGRAVITY_APP_DATA_DIR || path.join(os.homedir(), '.gemini', 'antigravity');
  return path.join(appDataDir, 'daemon');
}

function parseHubJsonFile(
  filePath: string,
  pid: number,
  extraPort?: number
): HubDaemonInfo | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw) as {
      pid?: unknown;
      httpPort?: unknown;
      csrfToken?: unknown;
    };
    if (!data || typeof data.csrfToken !== 'string' || !data.csrfToken) {
      return null;
    }
    if (typeof data.pid === 'number' && data.pid !== pid) {
      return null;
    }
    const ports: number[] = [];
    for (const candidate of [data.httpPort, extraPort]) {
      if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0 && !ports.includes(candidate)) {
        ports.push(candidate);
      }
    }
    return { csrfToken: data.csrfToken, ports };
  } catch {
    return null;
  }
}

/**
 * Read CSRF token and port info from ~/.gemini/antigravity/daemon/hub_<port>.json
 * for Antigravity hub processes (2.34.0+) that no longer pass --csrf_token on the CLI.
 */
export function readHubDaemonInfo(
  pid: number,
  commandLine: string,
  daemonDir = getDefaultDaemonDir()
): HubDaemonInfo | null {
  // Fast path: --hub-port=<port> or --hub-port <port> on command line
  const hubPortMatch = commandLine.match(/--hub-port[=\s]+(\d+)/i);
  if (hubPortMatch) {
    const hubPort = Number(hubPortMatch[1]);
    const info = parseHubJsonFile(path.join(daemonDir, `hub_${hubPort}.json`), pid, hubPort);
    if (info) return info;
  }

  // Fallback: scan daemon/hub_*.json and match by exact PID
  // (e.g., language_server 2.35.2 --subclient_type hub omits --hub-port)
  try {
    const files = fs.readdirSync(daemonDir);
    for (const file of files) {
      if (!file.startsWith('hub_') || !file.endsWith('.json')) continue;
      const filePath = path.join(daemonDir, file);
      const info = parseHubJsonFile(filePath, pid);
      if (info) return info;
    }
  } catch {
    // Daemon directory may not exist
  }

  return null;
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
    let csrfToken = proc.csrfToken;
    const candidatePorts: number[] = [];

    if (!csrfToken) {
      const hubInfo = readHubDaemonInfo(proc.pid, proc.commandLine);
      if (!hubInfo) continue;
      csrfToken = hubInfo.csrfToken;
      candidatePorts.push(...hubInfo.ports);
    }

    const listeningPorts = isWin ? findWindowsListeningPorts(proc.pid) : findUnixListeningPorts(proc.pid);
    for (const p of listeningPorts) {
      if (!candidatePorts.includes(p)) {
        candidatePorts.push(p);
      }
    }

    for (const port of candidatePorts) {
      const ok = await probePort(port, csrfToken);
      if (ok) {
        return {
          address: `localhost:${port}`,
          csrfToken,
          source: 'process',
        };
      }
    }
  }

  return null;
}
