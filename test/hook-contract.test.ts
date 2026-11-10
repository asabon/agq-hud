import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { buildHookOutput } from '../src/hook.js';
import { parseQuotaSummary } from '../src/client.js';
import { QuotaSummary } from '../src/types.js';

describe('Hook PreInvocation Contract Verification', () => {
  const sampleSummary: QuotaSummary = {
    userTierName: 'Google AI Pro',
    allModels: [],
    groups: [
      {
        family: 'Gemini 3.8 Flash',
        remainingPercentage: 85.0,
        timeUntilResetMs: 7200000,
        buckets: [],
        limit5h: {
          bucketId: '5h',
          displayName: '5h',
          window: '5h',
          remainingPercentage: 85.0,
          timeUntilResetMs: 7200000,
        },
        limitWeekly: {
          bucketId: 'weekly',
          displayName: 'weekly',
          window: 'weekly',
          remainingPercentage: 75.0,
          timeUntilResetMs: 144000000,
        },
        models: [
          {
            label: 'Gemini 3.8 Flash',
            modelId: 'gemini-3.8-flash',
            family: 'Gemini 3.8 Flash',
            tierVariant: '',
            remainingPercentage: 85.0,
            timeUntilResetMs: 7200000,
          },
        ],
      },
    ],
  };

  it('builds valid PreInvocationHookResult conforming to Antigravity contract', () => {
    const output = buildHookOutput(sampleSummary, 'Gemini 3.8 Flash');

    // 1. Must contain injectSteps array
    assert.ok(Array.isArray(output.injectSteps), 'injectSteps must be an array');
    assert.equal(output.injectSteps.length, 1, 'must inject 1 systemMessage step');

    const step = output.injectSteps[0];
    assert.ok(step.systemMessage, 'step must have systemMessage');

    // 2. systemMessage text must be populated
    assert.ok(typeof step.systemMessage.systemMessage === 'string', 'systemMessage must be string');
    assert.ok(step.systemMessage.systemMessage.length > 0, 'systemMessage must not be empty');

    // 3. renderInfo must be populated with title and markdown
    assert.ok(step.systemMessage.renderInfo, 'renderInfo must be present for chat UI rendering');
    assert.ok(typeof step.systemMessage.renderInfo.title === 'string', 'renderInfo.title must be string');
    assert.ok(step.systemMessage.renderInfo.title.length > 0, 'renderInfo.title must not be empty');
    assert.ok(typeof step.systemMessage.renderInfo.markdown === 'string', 'renderInfo.markdown must be string');
    assert.ok(step.systemMessage.renderInfo.markdown.length > 0, 'renderInfo.markdown must not be empty');

    // 4. CRITICAL: metadata MUST NOT be populated (avoids language_server.exe scrubber panic)
    const rawStep = step.systemMessage as Record<string, unknown>;
    assert.equal(
      rawStep.metadata,
      undefined,
      'metadata must be undefined to prevent Language Server proto scrubber panic'
    );

    // 5. terminationBehavior must be empty string to proceed with model invocation
    assert.equal(output.terminationBehavior, '', 'terminationBehavior must be empty to proceed');
  });

  it('parses realistic Language Server quota responses into QuotaSummary', () => {
    const mockStatus = {
      userStatus: {
        email: 'developer@example.com',
        userTier: {
          id: 'TIER_PRO',
          name: 'Google AI Pro',
          description: 'Google AI Pro Tier',
        },
        cascadeModelConfigData: {
          clientModelConfigs: [
            {
              label: 'Gemini 3.8 Flash',
              modelId: 'gemini-3.8-flash',
              quotaInfo: {
                remainingFraction: 0.85,
                resetTime: new Date(Date.now() + 3600000).toISOString(),
              },
            },
          ],
        },
      },
    };

    const mockQuotaSummary = {
      response: {
        groups: [
          {
            displayName: 'Gemini 3.8 Flash',
            buckets: [
              {
                bucketId: '5h',
                window: '5h',
                remainingFraction: 0.85,
                resetTime: new Date(Date.now() + 3600000).toISOString(),
              },
              {
                bucketId: '1w',
                window: '1w',
                remainingFraction: 0.75,
                resetTime: new Date(Date.now() + 86400000).toISOString(),
              },
            ],
          },
        ],
      },
    };

    const summary = parseQuotaSummary(mockStatus, mockQuotaSummary);
    assert.equal(summary.userTierName, 'Google AI Pro');
    assert.equal(summary.userEmail, 'developer@example.com');
    assert.ok(summary.groups.length > 0);
    assert.equal(summary.groups[0].family, 'Gemini 3.8 Flash');
    assert.ok(summary.groups[0].limit5h);
    assert.ok(summary.groups[0].limitWeekly);
  });

  it('standalone executable (bin/agq.cjs) responds to --help without crashing', () => {
    const binPath = path.resolve(__dirname, '../../bin/agq.cjs');
    const result = execFileSync(process.execPath, [binPath, '--help'], {
      encoding: 'utf8',
      timeout: 5000,
    });

    assert.match(result, /agq-hud/);
    assert.match(result, /USAGE/);
    assert.match(result, /--hook/);
    assert.match(result, /--signal/);
    assert.doesNotMatch(result, /^\s*agq\s+\[/m);
  });

  it('rejects invalid --signal values in CLI mode with non-zero exit code', () => {
    const binPath = path.resolve(__dirname, '../../bin/agq.cjs');
    assert.throws(
      () => {
        execFileSync(process.execPath, [binPath, '--signal', 'invalid'], {
          encoding: 'utf8',
          timeout: 5000,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      },
      (err: unknown) => {
        const execErr = err as { status?: number; stderr?: string };
        return execErr.status === 1 && typeof execErr.stderr === 'string' && execErr.stderr.includes('Invalid --signal');
      }
    );
  });

  it('applies signalMode in buildHookOutput while keeping 1-line HUD and clean renderInfo', () => {
    const weeklyPacedSummary: QuotaSummary = {
      userTierName: 'Google AI Pro',
      allModels: [],
      groups: [
        {
          family: 'Gemini 3.8 Flash',
          remainingPercentage: 95.0,
          timeUntilResetMs: 7200000,
          buckets: [],
          limit5h: {
            bucketId: '5h',
            displayName: '5h',
            window: '5h',
            remainingPercentage: 95.0,
            timeUntilResetMs: 7200000,
          },
          limitWeekly: {
            bucketId: 'weekly',
            displayName: 'weekly',
            window: 'weekly',
            remainingPercentage: 58.0,
            timeUntilResetMs: 72 * 60 * 60 * 1000,
          },
          models: [
            {
              label: 'Gemini 3.8 Flash',
              modelId: 'gemini-3.8-flash',
              family: 'Gemini 3.8 Flash',
              tierVariant: '',
              remainingPercentage: 95.0,
              timeUntilResetMs: 7200000,
            },
          ],
        },
      ],
    };

    const smartOut = buildHookOutput(weeklyPacedSummary, 'Gemini 3.8 Flash', { signalMode: 'smart' });
    const smartMsg = smartOut.injectSteps?.[0]?.systemMessage;
    assert.ok(smartMsg?.renderInfo?.markdown);
    assert.equal(smartMsg.renderInfo.markdown.includes('\n'), false);
    assert.match(smartMsg.renderInfo.markdown, /1w: `58\.0%` 🟢/);
    assert.match(smartMsg.renderInfo.title || '', /1w: 58\.0% 🟢/);

    const thresholdOut = buildHookOutput(weeklyPacedSummary, 'Gemini 3.8 Flash', { signalMode: 'threshold' });
    const thresholdMsg = thresholdOut.injectSteps?.[0]?.systemMessage;
    assert.ok(thresholdMsg?.renderInfo?.markdown);
    assert.equal(thresholdMsg.renderInfo.markdown.includes('\n'), false);
    assert.match(thresholdMsg.renderInfo.markdown, /1w: `58\.0%` 🟡/);
    assert.match(thresholdMsg.renderInfo.title || '', /1w: 58\.0% 🟡/);
  });

  it('exposes only agq-hud binary command in package.json', async () => {
    const pkgPath = path.resolve(__dirname, '../../package.json');
    const { readFileSync } = await import('node:fs');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    assert.deepEqual(pkg.bin, {
      'agq-hud': 'bin/agq.cjs',
    });
  });

  it('provides plugin agent rule file as rules/AGENTS.md adhering to Antigravity plugin convention', async () => {
    const rulePath = path.resolve(__dirname, '../../rules/AGENTS.md');
    const { existsSync, readFileSync } = await import('node:fs');

    assert.ok(existsSync(rulePath), 'rules/AGENTS.md must exist');
    const content = readFileSync(rulePath, 'utf8');
    assert.match(content, /Model Quota HUD Display Guideline/);
  });
});
