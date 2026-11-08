import { ModelGroupQuota, NormalizedModelQuota, QuotaSummary } from './types.js';

export function formatTimeRemaining(ms?: number): string {
  if (ms === undefined || isNaN(ms)) return 'Unknown';
  if (ms <= 0) return 'Reset now';

  const totalMinutes = Math.floor(ms / (1000 * 60));
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return '< 1m';
}

export function makeProgressBar(percentage: number, width = 10): string {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filledCount = Math.round((clamped / 100) * width);
  const emptyCount = width - filledCount;

  return '█'.repeat(filledCount) + '░'.repeat(emptyCount);
}

function getStatusBadge(percentage: number): { emoji: string; text: string; colorCode: string } {
  if (percentage <= 0) {
    return { emoji: '🔴', text: 'Empty', colorCode: '\x1b[31m' }; // Red
  }
  if (percentage < 25) {
    return { emoji: '⚠️', text: 'Low', colorCode: '\x1b[33m' }; // Yellow
  }
  if (percentage < 60) {
    return { emoji: '🟡', text: 'Fair', colorCode: '\x1b[36m' }; // Cyan
  }
  return { emoji: '🟢', text: 'Good', colorCode: '\x1b[32m' }; // Green
}

/**
 * Formats Markdown HUD for Antigravity Chat UI (metadata.user_markdown)
 */
export function formatHookMarkdown(summary: QuotaSummary, currentModelName?: string): string {
  const tier = summary.userTierName || 'Standard';
  const lines: string[] = [];

  lines.push(`> 📊 **AI Model Quota** &nbsp;·&nbsp; \`${tier}\``);
  lines.push(`> `);
  lines.push(`> | Model | Remaining | Bar | Reset In |`);
  lines.push(`> | :--- | :--- | :--- | :--- |`);

  for (const group of summary.groups) {
    const isCurrent =
      currentModelName &&
      (group.models.some((m) => currentModelName.toLowerCase().includes(m.family.toLowerCase())) ||
        currentModelName.toLowerCase().includes(group.family.toLowerCase()));

    const badge = getStatusBadge(group.remainingPercentage);
    const bar = makeProgressBar(group.remainingPercentage, 10);
    const resetStr = formatTimeRemaining(group.timeUntilResetMs);

    const nameDisplay = isCurrent ? `**${group.family}** 🎯` : `**${group.family}**`;
    const pctDisplay = `\`${group.remainingPercentage.toFixed(1)}%\``;

    lines.push(`> | ${nameDisplay} | ${pctDisplay} ${badge.emoji} | \`${bar}\` | ${resetStr} |`);
  }

  return lines.join('\n');
}

/**
 * Formats CLI Terminal Table
 */
export function formatCliTable(summary: QuotaSummary, verbose = false, isTty = true): string {
  const resetCode = isTty ? '\x1b[0m' : '';
  const boldCode = isTty ? '\x1b[1m' : '';
  const dimCode = isTty ? '\x1b[2m' : '';

  const out: string[] = [];
  out.push('');
  out.push(`${boldCode}⚡ AGQ HUD — Model Quota Monitor${resetCode}`);
  out.push(`${dimCode}Tier: ${resetCode}${boldCode}${summary.userTierName || 'Standard'}${resetCode}${
    summary.userEmail ? ` ${dimCode}(${summary.userEmail})${resetCode}` : ''
  }`);
  out.push('');

  const targetList = verbose
    ? summary.allModels.map((m) => ({
        name: m.label,
        percentage: m.remainingPercentage,
        resetMs: m.timeUntilResetMs,
      }))
    : summary.groups.map((g) => ({
        name: g.family,
        percentage: g.remainingPercentage,
        resetMs: g.timeUntilResetMs,
      }));

  // Column widths
  const maxNameLen = Math.max(16, ...targetList.map((item) => item.name.length));
  const colName = maxNameLen + 2;
  const colPct = 10;
  const colBar = 14;
  const colReset = 14;

  const sep = '─'.repeat(colName + colPct + colBar + colReset + 5);

  out.push(sep);
  out.push(
    ` ${'Model'.padEnd(colName)}${'Remaining'.padEnd(colPct)}${'Gauge'.padEnd(colBar)}${'Resets In'.padEnd(colReset)}`
  );
  out.push(sep);

  for (const item of targetList) {
    const badge = getStatusBadge(item.percentage);
    const color = isTty ? badge.colorCode : '';
    const bar = `[${makeProgressBar(item.percentage, 10)}]`;
    const pctStr = `${item.percentage.toFixed(1)}%`;
    const resetStr = formatTimeRemaining(item.resetMs);

    const nameCol = item.name.padEnd(colName);
    const pctCol = `${color}${pctStr.padEnd(colPct)}${resetCode}`;
    const barCol = `${color}${bar.padEnd(colBar)}${resetCode}`;
    const resetCol = resetStr.padEnd(colReset);

    out.push(` ${nameCol}${pctCol}${barCol}${resetCol}`);
  }

  out.push(sep);
  if (!verbose && summary.allModels.length > summary.groups.length) {
    out.push(`${dimCode}Tip: Run with -v or --verbose to view all model sub-variants.${resetCode}`);
  }
  out.push('');

  return out.join('\n');
}
