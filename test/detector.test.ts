import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { readHubDaemonInfo } from '../src/detector.js';

function withTempDaemonDir(fn: (dir: string) => void): void {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agq-hud-detector-'));
  try {
    fn(tmpDir);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('readHubDaemonInfo', () => {
  it('reads csrfToken and httpPort via --hub-port flag when PID matches', () => {
    withTempDaemonDir((dir) => {
      fs.writeFileSync(
        path.join(dir, 'hub_51445.json'),
        JSON.stringify({
          pid: 7144,
          httpsPort: 51448,
          httpPort: 51445,
          lsVersion: '2.34.0',
          csrfToken: 'token-abc-123',
        }),
        'utf8'
      );

      const info = readHubDaemonInfo(7144, 'agy.exe --hub --hub-port=51445 --app_data_dir=antigravity', dir);
      assert.deepEqual(info, {
        csrfToken: 'token-abc-123',
        ports: [51445],
      });
    });
  });

  it('ignores hub file when PID does not match', () => {
    withTempDaemonDir((dir) => {
      fs.writeFileSync(
        path.join(dir, 'hub_51445.json'),
        JSON.stringify({
          pid: 9999,
          httpPort: 51445,
          csrfToken: 'stale-token',
        }),
        'utf8'
      );

      const info = readHubDaemonInfo(7144, 'agy.exe --hub --hub-port=51445', dir);
      assert.equal(info, null);
    });
  });

  it('scans daemon directory and matches by PID when --hub-port is absent', () => {
    withTempDaemonDir((dir) => {
      fs.writeFileSync(
        path.join(dir, 'hub_50000.json'),
        JSON.stringify({ pid: 1111, httpPort: 50000, csrfToken: 'old-token' }),
        'utf8'
      );
      fs.writeFileSync(
        path.join(dir, 'hub_61230.json'),
        JSON.stringify({
          pid: 1840,
          httpsPort: 61229,
          httpPort: 61230,
          lsVersion: '2.35.2',
          csrfToken: 'live-token-xyz',
        }),
        'utf8'
      );
      fs.writeFileSync(path.join(dir, 'hub_broken.json'), '{not-valid-json', 'utf8');

      const info = readHubDaemonInfo(
        1840,
        'language_server.exe --standalone --subclient_type hub --override_ide_version 2.35.2',
        dir
      );
      assert.deepEqual(info, {
        csrfToken: 'live-token-xyz',
        ports: [61230],
      });
    });
  });

  it('returns null when daemon directory does not exist', () => {
    const info = readHubDaemonInfo(1840, 'language_server.exe --subclient_type hub', path.join(os.tmpdir(), 'nonexistent-agq-dir'));
    assert.equal(info, null);
  });

  it('rejects ports above 65535 while preserving valid fallback --hub-port', () => {
    withTempDaemonDir((dir) => {
      fs.writeFileSync(
        path.join(dir, 'hub_51445.json'),
        JSON.stringify({
          pid: 7144,
          httpPort: 65536,
          csrfToken: 'token-abc-123',
        }),
        'utf8'
      );

      const info = readHubDaemonInfo(7144, 'agy.exe --hub --hub-port=51445', dir);
      assert.deepEqual(info, {
        csrfToken: 'token-abc-123',
        ports: [51445],
      });
    });
  });

  it('requires exact PID match when scanning directory without --hub-port', () => {
    withTempDaemonDir((dir) => {
      fs.writeFileSync(
        path.join(dir, 'hub_50000.json'),
        JSON.stringify({ httpPort: 50000, csrfToken: 'no-pid-token' }),
        'utf8'
      );
      fs.writeFileSync(
        path.join(dir, 'hub_61230.json'),
        JSON.stringify({ pid: 1840, httpPort: 61230, csrfToken: 'exact-pid-token' }),
        'utf8'
      );

      const info = readHubDaemonInfo(1840, 'language_server.exe --subclient_type hub', dir);
      assert.deepEqual(info, {
        csrfToken: 'exact-pid-token',
        ports: [61230],
      });
    });
  });
});
