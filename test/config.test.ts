import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, parseSignalMode, resolveSignalMode } from '../src/config.js';

describe('signal mode configuration', () => {
  it('parses valid signal modes case-insensitively and rejects invalid ones', () => {
    assert.equal(parseSignalMode('smart'), 'smart');
    assert.equal(parseSignalMode('threshold'), 'threshold');
    assert.equal(parseSignalMode('  SMART '), 'smart');
    assert.equal(parseSignalMode('Threshold'), 'threshold');
    assert.equal(parseSignalMode('invalid'), undefined);
    assert.equal(parseSignalMode(''), undefined);
    assert.equal(parseSignalMode(undefined), undefined);
    assert.equal(parseSignalMode(123), undefined);
  });

  it('loads valid config file and ignores missing or malformed files', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agq-hud-config-'));
    try {
      const missingPath = path.join(tmpDir, 'missing.json');
      assert.deepEqual(loadConfig(missingPath), {});

      const validPath = path.join(tmpDir, 'valid.json');
      fs.writeFileSync(validPath, JSON.stringify({ signalMode: 'threshold' }), 'utf8');
      assert.deepEqual(loadConfig(validPath), { signalMode: 'threshold' });

      const invalidModePath = path.join(tmpDir, 'invalid-mode.json');
      fs.writeFileSync(invalidModePath, JSON.stringify({ signalMode: 'unknown' }), 'utf8');
      assert.deepEqual(loadConfig(invalidModePath), {});

      const malformedPath = path.join(tmpDir, 'malformed.json');
      fs.writeFileSync(malformedPath, '{ not json', 'utf8');
      assert.deepEqual(loadConfig(malformedPath), {});
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('resolves precedence: CLI > env > config > default (smart)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agq-hud-resolve-'));
    try {
      const configPath = path.join(tmpDir, 'agq-hud.json');
      fs.writeFileSync(configPath, JSON.stringify({ signalMode: 'threshold' }), 'utf8');

      // Default when nothing is set
      const missingPath = path.join(tmpDir, 'missing.json');
      assert.equal(resolveSignalMode({ envMode: '', configPath: missingPath }), 'smart');

      // Config file overrides default
      assert.equal(resolveSignalMode({ envMode: '', configPath }), 'threshold');

      // Env overrides config file
      assert.equal(resolveSignalMode({ envMode: 'smart', configPath }), 'smart');

      // CLI overrides env and config file
      assert.equal(
        resolveSignalMode({ cliMode: 'threshold', envMode: 'smart', configPath: missingPath }),
        'threshold'
      );

      // Invalid CLI/env falls back to lower-precedence source
      assert.equal(
        resolveSignalMode({ cliMode: 'bogus', envMode: 'invalid', configPath }),
        'threshold'
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
