import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatTimeRemaining,
  makeProgressBar,
  findMatchingGroup,
  getThresholdBadge,
  calculateWeeklyHoldRatio,
  getSmartWeeklyBadge,
  getStatusBadge,
  formatCompactHookMarkdown,
  formatHookTitle,
  formatHookMarkdown,
  formatCliTable,
} from '../src/formatter.js';
import { ModelGroupQuota, QuotaSummary } from '../src/types.js';

describe('formatTimeRemaining', () => {
  it('handles undefined or NaN', () => {
    assert.equal(formatTimeRemaining(undefined), 'Unknown');
    assert.equal(formatTimeRemaining(NaN), 'Unknown');
  });

  it('handles <= 0 as Reset now', () => {
    assert.equal(formatTimeRemaining(0), 'Reset now');
    assert.equal(formatTimeRemaining(-5000), 'Reset now');
  });

  it('formats days and hours', () => {
    const ms = (2 * 24 + 5) * 60 * 60 * 1000; // 2d 5h
    assert.equal(formatTimeRemaining(ms), '2d 5h');
  });

  it('formats hours and minutes', () => {
    const ms = (4 * 60 + 30) * 60 * 1000; // 4h 30m
    assert.equal(formatTimeRemaining(ms), '4h 30m');
  });

  it('formats minutes', () => {
    const ms = 45 * 60 * 1000; // 45m
    assert.equal(formatTimeRemaining(ms), '45m');
  });

  it('formats < 1m', () => {
    const ms = 30 * 1000; // 30s
    assert.equal(formatTimeRemaining(ms), '< 1m');
  });
});

describe('makeProgressBar', () => {
  it('renders empty bar at 0%', () => {
    assert.equal(makeProgressBar(0, 10), '░░░░░░░░░░');
    assert.equal(makeProgressBar(-10, 10), '░░░░░░░░░░');
  });

  it('renders half-full bar at 50%', () => {
    assert.equal(makeProgressBar(50, 10), '█████░░░░░');
  });

  it('renders full bar at 100%', () => {
    assert.equal(makeProgressBar(100, 10), '██████████');
    assert.equal(makeProgressBar(120, 10), '██████████');
  });
});

describe('findMatchingGroup', () => {
  const sampleGroups: ModelGroupQuota[] = [
    {
      family: 'Gemini 3.8 Flash',
      remainingPercentage: 80,
      timeUntilResetMs: 3600000,
      buckets: [],
      models: [
        {
          label: 'Gemini 3.8 Flash',
          modelId: 'gemini-3.8-flash',
          family: 'Gemini 3.8 Flash',
          tierVariant: '',
          remainingPercentage: 80,
          timeUntilResetMs: 3600000,
        },
      ],
    },
    {
      family: 'Claude 3.5 Sonnet',
      remainingPercentage: 50,
      timeUntilResetMs: 7200000,
      buckets: [],
      models: [
        {
          label: 'Claude 3.5 Sonnet',
          modelId: 'claude-3-5-sonnet-20241022',
          family: 'Claude 3.5 Sonnet',
          tierVariant: '',
          remainingPercentage: 50,
          timeUntilResetMs: 7200000,
        },
      ],
    },
  ];

  it('returns undefined for empty or inherit', () => {
    assert.equal(findMatchingGroup(sampleGroups, undefined), undefined);
    assert.equal(findMatchingGroup(sampleGroups, ''), undefined);
    assert.equal(findMatchingGroup(sampleGroups, 'inherit'), undefined);
  });

  it('matches exact modelId or label', () => {
    const match = findMatchingGroup(sampleGroups, 'gemini-3.8-flash');
    assert.equal(match?.family, 'Gemini 3.8 Flash');
  });

  it('matches family name case-insensitively', () => {
    const match = findMatchingGroup(sampleGroups, 'claude 3.5 sonnet');
    assert.equal(match?.family, 'Claude 3.5 Sonnet');
  });

  it('matches fuzzy keyword tokens', () => {
    const match = findMatchingGroup(sampleGroups, 'flash');
    assert.equal(match?.family, 'Gemini 3.8 Flash');
  });
});

describe('formatHookTitle and formatHookMarkdown', () => {
  const sampleSummary: QuotaSummary = {
    userTierName: 'Google AI Pro',
    allModels: [],
    groups: [
      {
        family: 'Gemini 3.8 Flash',
        remainingPercentage: 80.5,
        timeUntilResetMs: 3600000,
        buckets: [],
        limit5h: {
          bucketId: '5h',
          displayName: '5h',
          window: '5h',
          remainingPercentage: 80.5,
          timeUntilResetMs: 3600000,
        },
        limitWeekly: {
          bucketId: 'weekly',
          displayName: 'weekly',
          window: 'weekly',
          remainingPercentage: 70.0,
          timeUntilResetMs: 86400000,
        },
        models: [
          {
            label: 'Gemini 3.8 Flash',
            modelId: 'gemini-3.8-flash',
            family: 'Gemini 3.8 Flash',
            tierVariant: '',
            remainingPercentage: 80.5,
            timeUntilResetMs: 3600000,
          },
        ],
      },
    ],
  };

  it('formats title with 5h and 1w percentages when available', () => {
    const title = formatHookTitle(sampleSummary, 'Gemini 3.8 Flash');
    assert.match(title, /⚡ Quota: Gemini 3.8 Flash/);
    assert.match(title, /5h: 80\.5%/);
    assert.match(title, /1w: 70\.0%/);
  });

  it('formats fallback title when no model matches', () => {
    const title = formatHookTitle(sampleSummary, 'unknown-model');
    assert.equal(title, '⚡ Model Quota HUD (Google AI Pro)');
  });

  it('formats compact hook markdown with status badges and reset info', () => {
    const md = formatCompactHookMarkdown(sampleSummary.groups[0], 'Google AI Pro');
    assert.match(md, /> 📊 \*\*Gemini 3.8 Flash\*\*/);
    assert.match(md, /5h: `80\.5%`/);
    assert.match(md, /1w: `70\.0%`/);
    assert.match(md, /Google AI Pro/);
  });

  it('formats hook markdown in table mode when requested', () => {
    const md = formatHookMarkdown(sampleSummary, 'Gemini 3.8 Flash', { format: 'table' });
    assert.match(md, /\| Model \| 5h Limit \| 1w Limit \|/);
    assert.match(md, /Gemini 3.8 Flash/);
  });

  it('formats CLI table output', () => {
    const cli = formatCliTable(sampleSummary, false, false);
    assert.match(cli, /AGQ HUD/);
    assert.match(cli, /Google AI Pro/);
    assert.match(cli, /Gemini 3.8 Flash/);
  });
});

describe('signal modes (smart and threshold)', () => {
  const HOUR_MS = 60 * 60 * 1000;
  const DAY_MS = 24 * HOUR_MS;

  it('uses 3-stage threshold badges (60% / 25%) without warning emoji', () => {
    assert.equal(getThresholdBadge(0).emoji, '🔴');
    assert.equal(getThresholdBadge(-5).emoji, '🔴');
    assert.equal(getThresholdBadge(24.9).emoji, '🔴');
    assert.equal(getThresholdBadge(25).emoji, '🟡');
    assert.equal(getThresholdBadge(59.9).emoji, '🟡');
    assert.equal(getThresholdBadge(60).emoji, '🟢');
    assert.equal(getThresholdBadge(100).emoji, '🟢');
  });

  it('computes continuous HoldRatio for weekly bucket without boundary jumps', () => {
    // Mid-week on-pace: 50% remaining, 3.5d remaining -> HoldRatio = 1.0
    const onPace = calculateWeeklyHoldRatio(50, 3.5 * DAY_MS);
    assert.ok(Math.abs(onPace - 1.0) < 1e-6);

    // 58.9% remaining with 3d 2h (74h) left -> plenty of headroom -> HoldRatio > 0.90 (Green)
    const relaxed = calculateWeeklyHoldRatio(58.9, 74 * HOUR_MS);
    assert.ok(relaxed > 1.5);
    assert.equal(getSmartWeeklyBadge(58.9, 74 * HOUR_MS).emoji, '🟢');

    // End of week: 1 day left (15% of 168h ≈ 25.2h), 10% remaining -> HoldRatio ≈ 0.635 (Yellow)
    const lateYellow = calculateWeeklyHoldRatio(10, 0.15 * 7 * DAY_MS);
    assert.ok(lateYellow >= 0.60 && lateYellow < 0.90);
    assert.equal(getSmartWeeklyBadge(10, 0.15 * 7 * DAY_MS).emoji, '🟡');

    // Early heavy consumption: 6 days left, 20% remaining -> Red
    assert.equal(getSmartWeeklyBadge(20, 6 * DAY_MS).emoji, '🔴');

    // Edge cases: <= 0% is always Red; reset reached with > 0% is Green; missing time falls back to threshold
    assert.equal(getSmartWeeklyBadge(0, 3 * DAY_MS).emoji, '🔴');
    assert.equal(getSmartWeeklyBadge(20, 0).emoji, '🟢');
    assert.equal(getSmartWeeklyBadge(20, undefined).emoji, '🔴');
    assert.equal(getSmartWeeklyBadge(50, undefined).emoji, '🟡');
  });

  it('applies smart mode only to weekly bucket and threshold to 5h or unknown buckets', () => {
    // 5h bucket at 50% stays Yellow even in smart mode
    assert.equal(
      getStatusBadge(50, { signalMode: 'smart', window: '5h', timeUntilResetMs: 1 * HOUR_MS }).emoji,
      '🟡'
    );
    // 5h bucket at 20% is Red (no warning emoji)
    assert.equal(
      getStatusBadge(20, { signalMode: 'smart', window: '5h', timeUntilResetMs: 1 * HOUR_MS }).emoji,
      '🔴'
    );
    // Unknown window falls back to threshold
    assert.equal(
      getStatusBadge(50, { signalMode: 'smart', timeUntilResetMs: 4 * DAY_MS }).emoji,
      '🟡'
    );
    // Weekly bucket switches between smart and threshold
    assert.equal(
      getStatusBadge(58.9, { signalMode: 'smart', window: 'weekly', timeUntilResetMs: 74 * HOUR_MS }).emoji,
      '🟢'
    );
    assert.equal(
      getStatusBadge(58.9, { signalMode: 'threshold', window: 'weekly', timeUntilResetMs: 74 * HOUR_MS }).emoji,
      '🟡'
    );
  });

  it('propagates signalMode consistently across compact HUD, title, markdown table, and CLI table', () => {
    const summary: QuotaSummary = {
      userTierName: 'Google AI Pro',
      allModels: [],
      groups: [
        {
          family: 'Gemini 3.8 Flash',
          remainingPercentage: 55.0,
          timeUntilResetMs: 2 * HOUR_MS,
          buckets: [],
          limit5h: {
            bucketId: '5h',
            displayName: '5h',
            window: '5h',
            remainingPercentage: 55.0,
            timeUntilResetMs: 2 * HOUR_MS,
          },
          limitWeekly: {
            bucketId: '1w',
            displayName: '1w',
            window: '', // Test empty window still treated as weekly when in limitWeekly
            remainingPercentage: 58.9,
            timeUntilResetMs: 74 * HOUR_MS,
          },
          models: [
            {
              label: 'Gemini 3.8 Flash',
              modelId: 'gemini-3.8-flash',
              family: 'Gemini 3.8 Flash',
              tierVariant: '',
              remainingPercentage: 55.0,
              timeUntilResetMs: 2 * HOUR_MS,
            },
          ],
        },
      ],
    };

    // Smart mode (default): 5h=55% (🟡), 1w=58.9% with 74h left (🟢)
    const compactSmart = formatCompactHookMarkdown(summary.groups[0], 'Google AI Pro', 'smart');
    assert.match(compactSmart, /5h: `55\.0%` 🟡/);
    assert.match(compactSmart, /1w: `58\.9%` 🟢/);
    assert.equal(compactSmart.includes('\n'), false);

    const titleSmart = formatHookTitle(summary, 'Gemini 3.8 Flash', { signalMode: 'smart' });
    assert.match(titleSmart, /5h: 55\.0% 🟡/);
    assert.match(titleSmart, /1w: 58\.9% 🟢/);

    const tableSmart = formatHookMarkdown(summary, 'Gemini 3.8 Flash', {
      format: 'table',
      signalMode: 'smart',
    });
    assert.match(tableSmart, /`55\.0%` 🟡 \| `58\.9%` 🟢/);

    const cliSmart = formatCliTable(summary, false, false, undefined, 'smart');
    assert.match(cliSmart, /55\.0% 🟡\s+58\.9% 🟢/);

    // Threshold mode: 5h=55% (🟡), 1w=58.9% (🟡)
    const compactThreshold = formatCompactHookMarkdown(summary.groups[0], 'Google AI Pro', 'threshold');
    assert.match(compactThreshold, /5h: `55\.0%` 🟡/);
    assert.match(compactThreshold, /1w: `58\.9%` 🟡/);

    const titleThreshold = formatHookTitle(summary, 'Gemini 3.8 Flash', { signalMode: 'threshold' });
    assert.match(titleThreshold, /5h: 55\.0% 🟡/);
    assert.match(titleThreshold, /1w: 58\.9% 🟡/);

    const tableThreshold = formatHookMarkdown(summary, 'Gemini 3.8 Flash', {
      format: 'table',
      signalMode: 'threshold',
    });
    assert.match(tableThreshold, /`55\.0%` 🟡 \| `58\.9%` 🟡/);

    const cliThreshold = formatCliTable(summary, false, false, undefined, 'threshold');
    assert.match(cliThreshold, /55\.0% 🟡\s+58\.9% 🟡/);
  });
});
