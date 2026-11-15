/**
 * Hook payload generator and handling for Antigravity PreInvocation lifecycle hooks.
 *
 * This module formats quota status information and constructs hook responses
 * conforming strictly to the Antigravity Language Server hook protocol.
 */

import { formatHookMarkdown, formatHookTitle } from './formatter.js';
import { HookPreInvocationOutput, QuotaSummary, SignalMode } from './types.js';

/**
 * Builds the PreInvocation hook output object for Antigravity Language Server.
 *
 * Strictly adheres to the Antigravity Language Server hook contract:
 * - Omits `metadata` from `HookSystemMessage` to prevent protobuf scrubber panic.
 * - Injects `title` and `markdown` inside `renderInfo` for UI accordion display.
 *
 * @param summary - Parsed quota summary containing model groups and tier information.
 * @param modelName - Optional current model name to highlight or filter.
 * @param options - Options controlling whether to show all models and signal display mode.
 * @returns PreInvocation hook output payload.
 */
export function buildHookOutput(
  summary: QuotaSummary,
  modelName?: string,
  options?: { forceAll?: boolean; signalMode?: SignalMode }
): HookPreInvocationOutput {
  const markdown = formatHookMarkdown(summary, modelName, {
    forceAll: options?.forceAll,
    signalMode: options?.signalMode,
  });

  const title = formatHookTitle(summary, modelName, {
    forceAll: options?.forceAll,
    signalMode: options?.signalMode,
  });

  return {
    injectSteps: [
      {
        systemMessage: {
          systemMessage: markdown,
          renderInfo: {
            title,
            markdown,
          },
        },
      },
    ],
    terminationBehavior: '',
  };
}
