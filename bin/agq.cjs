#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/client.ts
var import_http = __toESM(require("http"));
function fetchUserStatus(conn, timeoutMs = 3e3) {
  return new Promise((resolve, reject) => {
    let host = "localhost";
    let port = 80;
    if (conn.address.includes(":")) {
      const parts = conn.address.split(":");
      host = parts[0] || "localhost";
      port = Number(parts[1]) || 80;
    } else {
      host = conn.address;
    }
    const postData = "{}";
    const req = import_http.default.request(
      {
        hostname: host,
        port,
        path: "/exa.language_server_pb.LanguageServerService/GetUserStatus",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-codeium-csrf-token": conn.csrfToken,
          "Content-Length": Buffer.byteLength(postData)
        },
        timeout: timeoutMs
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body);
              resolve(data);
            } catch (err) {
              reject(new Error(`Failed to parse response JSON: ${err.message}`));
            }
          } else {
            reject(new Error(`RPC returned status code ${res.statusCode}: ${body.slice(0, 100)}`));
          }
        });
      }
    );
    req.on("error", (err) => reject(err));
    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    });
    req.write(postData);
    req.end();
  });
}
function fetchUserQuotaSummary(conn, timeoutMs = 3e3) {
  return new Promise((resolve) => {
    let host = "localhost";
    let port = 80;
    if (conn.address.includes(":")) {
      const parts = conn.address.split(":");
      host = parts[0] || "localhost";
      port = Number(parts[1]) || 80;
    } else {
      host = conn.address;
    }
    const postData = JSON.stringify({
      metadata: {
        ideName: "antigravity",
        extensionName: "antigravity",
        locale: "en"
      }
    });
    const req = import_http.default.request(
      {
        hostname: host,
        port,
        path: "/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Connect-Protocol-Version": "1",
          "x-codeium-csrf-token": conn.csrfToken,
          "Content-Length": Buffer.byteLength(postData)
        },
        timeout: timeoutMs
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const data = JSON.parse(body);
              resolve(data);
            } catch {
              resolve(void 0);
            }
          } else {
            resolve(void 0);
          }
        });
      }
    );
    req.on("error", () => resolve(void 0));
    req.on("timeout", () => {
      req.destroy();
      resolve(void 0);
    });
    req.write(postData);
    req.end();
  });
}
async function fetchFullQuota(conn, timeoutMs = 3e3) {
  const [statusResult, summaryResult] = await Promise.allSettled([
    fetchUserStatus(conn, timeoutMs),
    fetchUserQuotaSummary(conn, timeoutMs)
  ]);
  if (statusResult.status === "rejected") {
    throw statusResult.reason;
  }
  const statusData = statusResult.value;
  const quotaSummaryData = summaryResult.status === "fulfilled" ? summaryResult.value : void 0;
  return { statusData, quotaSummaryData };
}
function parseModelFamily(label) {
  const match = label.match(/^(.*?)(?:\s*\((Low|Medium|High)\))?$/i);
  if (match) {
    return {
      family: match[1].trim(),
      variant: match[2] || ""
    };
  }
  return { family: label, variant: "" };
}
function parseServerQuotaGroups(quotaSummary, now = /* @__PURE__ */ new Date()) {
  const rawGroups = quotaSummary?.response?.groups || [];
  const result = [];
  for (const g of rawGroups) {
    const displayName = g.displayName || "Unknown Group";
    const buckets = [];
    let limit5h;
    let limitWeekly;
    for (const b of g.buckets || []) {
      const bucketId = b.bucketId || "unknown";
      const bDisplayName = b.displayName || bucketId;
      const window = (b.window || "").toLowerCase();
      const fraction = b.remainingFraction ?? 1;
      const remainingPercentage = Math.round(fraction * 1e3) / 10;
      let resetDate;
      let timeUntilResetMs;
      if (b.resetTime) {
        resetDate = new Date(b.resetTime);
        timeUntilResetMs = Math.max(0, resetDate.getTime() - now.getTime());
      }
      const bucketInfo = {
        bucketId,
        displayName: bDisplayName,
        description: b.description,
        window: window === "weekly" ? "weekly" : window === "5h" ? "5h" : window,
        remainingFraction: fraction,
        remainingPercentage,
        resetTime: b.resetTime,
        resetDate,
        timeUntilResetMs
      };
      buckets.push(bucketInfo);
      if (window === "5h" || bucketId.includes("5h")) {
        limit5h = bucketInfo;
      } else if (window === "weekly" || bucketId.includes("weekly")) {
        limitWeekly = bucketInfo;
      }
    }
    result.push({
      displayName,
      buckets,
      limit5h,
      limitWeekly
    });
  }
  return result;
}
function findServerGroupForFamily(family, groups) {
  const f = family.toLowerCase().trim();
  if (f.includes("argon")) {
    return groups.find((g) => g.displayName.toLowerCase().includes("argon"));
  }
  if (f.includes("gemini")) {
    return groups.find(
      (g) => g.displayName.toLowerCase().includes("gemini") && !g.displayName.toLowerCase().includes("argon")
    );
  }
  if (f.includes("claude") || f.includes("gpt")) {
    return groups.find(
      (g) => g.displayName.toLowerCase().includes("claude") || g.displayName.toLowerCase().includes("gpt")
    );
  }
  return groups.find((g) => {
    const d = g.displayName.toLowerCase();
    return d.includes(f) || f.includes(d);
  });
}
function parseQuotaSummary(data, quotaSummaryData) {
  const userStatus = data.userStatus;
  const userTierName = userStatus?.userTier?.name || userStatus?.planStatus?.planInfo?.planName || "Standard";
  const planName = userStatus?.planStatus?.planInfo?.planName;
  const userEmail = userStatus?.email;
  const rawConfigs = userStatus?.cascadeModelConfigData?.clientModelConfigs || [];
  const now = /* @__PURE__ */ new Date();
  const parsedServerGroups = parseServerQuotaGroups(quotaSummaryData, now);
  const allModels = rawConfigs.filter((c) => c.quotaInfo !== void 0).map((c) => {
    const { family, variant } = parseModelFamily(c.label);
    const remainingFraction = c.quotaInfo.remainingFraction;
    const remainingPercentage = Math.round(remainingFraction * 1e3) / 10;
    let resetDate;
    let timeUntilResetMs;
    if (c.quotaInfo.resetTime) {
      resetDate = new Date(c.quotaInfo.resetTime);
      timeUntilResetMs = Math.max(0, resetDate.getTime() - now.getTime());
    }
    const serverGroup = findServerGroupForFamily(family, parsedServerGroups);
    return {
      label: c.label,
      modelId: c.modelId,
      family,
      tierVariant: variant,
      remainingPercentage,
      resetTime: c.quotaInfo.resetTime,
      resetDate,
      timeUntilResetMs,
      limit5h: serverGroup?.limit5h,
      limitWeekly: serverGroup?.limitWeekly
    };
  });
  const groupMap = /* @__PURE__ */ new Map();
  for (const m of allModels) {
    if (!groupMap.has(m.family)) {
      groupMap.set(m.family, []);
    }
    groupMap.get(m.family).push(m);
  }
  const groups = [];
  for (const [family, models] of groupMap.entries()) {
    const rep = models[0];
    const serverGroup = findServerGroupForFamily(family, parsedServerGroups);
    const primaryPercentage = serverGroup?.limit5h?.remainingPercentage ?? rep.remainingPercentage;
    const primaryResetTime = serverGroup?.limit5h?.resetTime ?? rep.resetTime;
    const primaryResetMs = serverGroup?.limit5h?.timeUntilResetMs ?? rep.timeUntilResetMs;
    groups.push({
      family,
      remainingPercentage: primaryPercentage,
      resetTime: primaryResetTime,
      timeUntilResetMs: primaryResetMs,
      models,
      limit5h: serverGroup?.limit5h,
      limitWeekly: serverGroup?.limitWeekly,
      buckets: serverGroup?.buckets || []
    });
  }
  return {
    userTierName,
    planName,
    userEmail,
    groups,
    allModels
  };
}

// src/detector.ts
var import_child_process = require("child_process");
var import_http2 = __toESM(require("http"));
function probePort(port, csrfToken, timeoutMs = 400) {
  return new Promise((resolve) => {
    const req = import_http2.default.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/healthz",
        method: "GET",
        timeout: timeoutMs
      },
      (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          probeRpc(port, csrfToken, timeoutMs).then(resolve);
        }
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}
function probeRpc(port, csrfToken, timeoutMs = 400) {
  return new Promise((resolve) => {
    const postData = "{}";
    const req = import_http2.default.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/exa.language_server_pb.LanguageServerService/GetUserStatus",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-codeium-csrf-token": csrfToken,
          "Content-Length": Buffer.byteLength(postData)
        },
        timeout: timeoutMs
      },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.write(postData);
    req.end();
  });
}
function findWindowsProcesses() {
  const results = [];
  try {
    const psCmd = `powershell -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process -Filter \\"name like '%language_server%' or name like '%agy%'\\" | Select-Object ProcessId, CommandLine | ConvertTo-Json"`;
    const output = (0, import_child_process.execSync)(psCmd, { encoding: "utf8", timeout: 3e3, stdio: ["ignore", "pipe", "ignore"] });
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
        csrfToken: tokenMatch ? tokenMatch[1] : void 0
      });
    }
  } catch {
    try {
      const wmicOutput = (0, import_child_process.execSync)(`wmic process where "name like '%language_server%'" get ProcessId,CommandLine /format:csv`, {
        encoding: "utf8",
        timeout: 3e3,
        stdio: ["ignore", "pipe", "ignore"]
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
            csrfToken: tokenMatch ? tokenMatch[1] : void 0
          });
        }
      }
    } catch {
    }
  }
  return results;
}
function findWindowsListeningPorts(pid) {
  const ports = [];
  try {
    const netstatOut = (0, import_child_process.execSync)(`netstat -ano | findstr "${pid}"`, {
      encoding: "utf8",
      timeout: 2e3,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const lines = netstatOut.split(/\r?\n/);
    for (const line of lines) {
      if (line.includes("LISTENING") || line.includes("LISTENER")) {
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
  }
  return ports;
}
function findUnixProcesses() {
  const results = [];
  try {
    const psOut = (0, import_child_process.execSync)("ps -eo pid,command", {
      encoding: "utf8",
      timeout: 3e3,
      stdio: ["ignore", "pipe", "ignore"]
    });
    const lines = psOut.split(/\n/);
    for (const line of lines) {
      if (line.includes("language_server") && !line.includes("grep")) {
        const match = line.trim().match(/^(\d+)\s+(.+)$/);
        if (match) {
          const pid = Number(match[1]);
          const commandLine = match[2];
          const tokenMatch = commandLine.match(/--csrf_token\s+([a-f0-9-]+)/i);
          results.push({
            pid,
            commandLine,
            csrfToken: tokenMatch ? tokenMatch[1] : void 0
          });
        }
      }
    }
  } catch {
  }
  return results;
}
function findUnixListeningPorts(pid) {
  const ports = [];
  try {
    const lsofOut = (0, import_child_process.execSync)(`lsof -iTCP -sTCP:LISTEN -n -P -p ${pid} 2>/dev/null`, {
      encoding: "utf8",
      timeout: 2e3,
      stdio: ["ignore", "pipe", "ignore"]
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
    try {
      const ssOut = (0, import_child_process.execSync)(`ss -tlnp 2>/dev/null | grep "${pid}"`, {
        encoding: "utf8",
        timeout: 2e3,
        stdio: ["ignore", "pipe", "ignore"]
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
    }
  }
  return ports;
}
async function detectConnection() {
  const envAddress = process.env.ANTIGRAVITY_LS_ADDRESS;
  const envToken = process.env.ANTIGRAVITY_CSRF_TOKEN;
  if (envAddress && envToken) {
    return {
      address: envAddress,
      csrfToken: envToken,
      source: "env"
    };
  }
  const isWin = process.platform === "win32";
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
          source: "process"
        };
      }
    }
  }
  return null;
}

// src/formatter.ts
function formatTimeRemaining(ms) {
  if (ms === void 0 || isNaN(ms)) return "Unknown";
  if (ms <= 0) return "Reset now";
  const totalMinutes = Math.floor(ms / (1e3 * 60));
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
  return "< 1m";
}
function makeProgressBar(percentage, width = 10) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filledCount = Math.round(clamped / 100 * width);
  const emptyCount = width - filledCount;
  return "\u2588".repeat(filledCount) + "\u2591".repeat(emptyCount);
}
function getStatusBadge(percentage) {
  if (percentage <= 0) {
    return { emoji: "\u{1F534}", text: "Empty", colorCode: "\x1B[31m" };
  }
  if (percentage < 25) {
    return { emoji: "\u26A0\uFE0F", text: "Low", colorCode: "\x1B[33m" };
  }
  if (percentage < 60) {
    return { emoji: "\u{1F7E1}", text: "Fair", colorCode: "\x1B[36m" };
  }
  return { emoji: "\u{1F7E2}", text: "Good", colorCode: "\x1B[32m" };
}
function findMatchingGroup(groups, currentModelName) {
  if (!currentModelName) return void 0;
  const raw = currentModelName.trim().toLowerCase();
  if (!raw || raw === "inherit") return void 0;
  const normalize = (s) => s.toLowerCase().replace(/[-_.]/g, " ").replace(/\s+/g, " ").trim();
  const normalizedRaw = normalize(raw);
  for (const group of groups) {
    for (const m of group.models) {
      const normLabel = normalize(m.label);
      const normId = normalize(m.modelId);
      if (normLabel === normalizedRaw || normId === normalizedRaw || normLabel.includes(normalizedRaw) || normalizedRaw.includes(normLabel) || normId.includes(normalizedRaw) || normalizedRaw.includes(normId)) {
        return group;
      }
    }
  }
  for (const group of groups) {
    const normFamily = normalize(group.family);
    if (normFamily === normalizedRaw || normFamily.includes(normalizedRaw) || normalizedRaw.includes(normFamily)) {
      return group;
    }
  }
  const tokens = normalizedRaw.split(" ").filter((t) => t.length > 2);
  for (const group of groups) {
    const normFamily = normalize(group.family);
    if (tokens.some((token) => normFamily.includes(token))) {
      return group;
    }
  }
  return void 0;
}
function formatCompactHookMarkdown(group, userTierName) {
  const tier = userTierName ? ` &nbsp;\xB7&nbsp; \`${userTierName}\`` : "";
  if (group.limit5h && group.limitWeekly) {
    const badge5h = getStatusBadge(group.limit5h.remainingPercentage);
    const badgeW = getStatusBadge(group.limitWeekly.remainingPercentage);
    const reset5h = formatTimeRemaining(group.limit5h.timeUntilResetMs);
    const resetW = formatTimeRemaining(group.limitWeekly.timeUntilResetMs);
    return `> \u{1F4CA} **${group.family}** &nbsp;\xB7&nbsp; 5h: \`${group.limit5h.remainingPercentage.toFixed(1)}%\` ${badge5h.emoji} (${reset5h}) &nbsp;\xB7&nbsp; 1w: \`${group.limitWeekly.remainingPercentage.toFixed(1)}%\` ${badgeW.emoji} (${resetW})${tier}`;
  }
  if (group.limitWeekly && !group.limit5h) {
    const badgeW = getStatusBadge(group.limitWeekly.remainingPercentage);
    const bar2 = makeProgressBar(group.limitWeekly.remainingPercentage, 10);
    const resetW = formatTimeRemaining(group.limitWeekly.timeUntilResetMs);
    return `> \u{1F4CA} **${group.family}** &nbsp;\xB7&nbsp; 1w: \`${group.limitWeekly.remainingPercentage.toFixed(1)}%\` ${badgeW.emoji} \`${bar2}\` &nbsp;\xB7&nbsp; Reset: **${resetW}**${tier}`;
  }
  const badge = getStatusBadge(group.remainingPercentage);
  const bar = makeProgressBar(group.remainingPercentage, 10);
  const resetStr = formatTimeRemaining(group.timeUntilResetMs);
  const pctDisplay = `\`${group.remainingPercentage.toFixed(1)}%\``;
  return `> \u{1F4CA} **${group.family}** &nbsp;\xB7&nbsp; ${pctDisplay} ${badge.emoji} \`${bar}\` &nbsp;\xB7&nbsp; Reset: **${resetStr}**${tier}`;
}
function formatHookTitle(summary, currentModelName, options) {
  const forceAll = options?.forceAll ?? process.env.AGQ_SHOW_ALL === "1";
  const matchedGroup = !forceAll ? findMatchingGroup(summary.groups, currentModelName) : void 0;
  if (matchedGroup) {
    if (matchedGroup.limit5h && matchedGroup.limitWeekly) {
      const b5h = getStatusBadge(matchedGroup.limit5h.remainingPercentage).emoji;
      const bW = getStatusBadge(matchedGroup.limitWeekly.remainingPercentage).emoji;
      return `\u26A1 Quota: ${matchedGroup.family} \xB7 5h: ${matchedGroup.limit5h.remainingPercentage.toFixed(1)}% ${b5h} \xB7 1w: ${matchedGroup.limitWeekly.remainingPercentage.toFixed(1)}% ${bW}`;
    }
    if (matchedGroup.limitWeekly && !matchedGroup.limit5h) {
      const bW = getStatusBadge(matchedGroup.limitWeekly.remainingPercentage).emoji;
      return `\u26A1 Quota: ${matchedGroup.family} \xB7 1w: ${matchedGroup.limitWeekly.remainingPercentage.toFixed(1)}% ${bW}`;
    }
    const b = getStatusBadge(matchedGroup.remainingPercentage).emoji;
    return `\u26A1 Quota: ${matchedGroup.family} \xB7 ${matchedGroup.remainingPercentage.toFixed(1)}% ${b}`;
  }
  const tier = summary.userTierName ? ` (${summary.userTierName})` : "";
  return `\u26A1 Model Quota HUD${tier}`;
}
function formatHookMarkdown(summary, currentModelName, options) {
  const forceAll = options?.forceAll ?? process.env.AGQ_SHOW_ALL === "1";
  const preferTable = options?.format === "table" || process.env.AGQ_HUD_FORMAT === "table";
  const matchedGroup = !forceAll ? findMatchingGroup(summary.groups, currentModelName) : void 0;
  if (matchedGroup && !preferTable) {
    return formatCompactHookMarkdown(matchedGroup, summary.userTierName);
  }
  const targetGroups = matchedGroup ? [matchedGroup] : summary.groups;
  const tier = summary.userTierName || "Standard";
  const hasMultiWindow = targetGroups.some((g) => g.limit5h !== void 0 || g.limitWeekly !== void 0);
  const lines = [];
  lines.push(`> \u{1F4CA} **AI Model Quota** &nbsp;\xB7&nbsp; \`${tier}\``);
  lines.push(`> `);
  if (hasMultiWindow) {
    lines.push(`> | Model | 5h Limit | 1w Limit | Reset (5h) | Reset (1w) |`);
    lines.push(`> | :--- | :--- | :--- | :--- | :--- |`);
    for (const group of targetGroups) {
      const isCurrent = matchedGroup ? true : currentModelName && (group.models.some((m) => currentModelName.toLowerCase().includes(m.family.toLowerCase())) || currentModelName.toLowerCase().includes(group.family.toLowerCase()));
      const nameDisplay = isCurrent && targetGroups.length > 1 ? `**${group.family}** \u{1F3AF}` : `**${group.family}**`;
      const p5h = group.limit5h ? `\`${group.limit5h.remainingPercentage.toFixed(1)}%\` ${getStatusBadge(group.limit5h.remainingPercentage).emoji}` : "-";
      const pW = group.limitWeekly ? `\`${group.limitWeekly.remainingPercentage.toFixed(1)}%\` ${getStatusBadge(group.limitWeekly.remainingPercentage).emoji}` : "-";
      const reset5h = group.limit5h ? formatTimeRemaining(group.limit5h.timeUntilResetMs) : "-";
      const resetW = group.limitWeekly ? formatTimeRemaining(group.limitWeekly.timeUntilResetMs) : "-";
      lines.push(`> | ${nameDisplay} | ${p5h} | ${pW} | ${reset5h} | ${resetW} |`);
    }
  } else {
    lines.push(`> | Model | Remaining | Bar | Reset In |`);
    lines.push(`> | :--- | :--- | :--- | :--- |`);
    for (const group of targetGroups) {
      const isCurrent = matchedGroup ? true : currentModelName && (group.models.some((m) => currentModelName.toLowerCase().includes(m.family.toLowerCase())) || currentModelName.toLowerCase().includes(group.family.toLowerCase()));
      const badge = getStatusBadge(group.remainingPercentage);
      const bar = makeProgressBar(group.remainingPercentage, 10);
      const resetStr = formatTimeRemaining(group.timeUntilResetMs);
      const nameDisplay = isCurrent && targetGroups.length > 1 ? `**${group.family}** \u{1F3AF}` : `**${group.family}**`;
      const pctDisplay = `\`${group.remainingPercentage.toFixed(1)}%\``;
      lines.push(`> | ${nameDisplay} | ${pctDisplay} ${badge.emoji} | \`${bar}\` | ${resetStr} |`);
    }
  }
  return lines.join("\n");
}
function formatCliTable(summary, verbose = false, isTty = true, filter) {
  const resetCode = isTty ? "\x1B[0m" : "";
  const boldCode = isTty ? "\x1B[1m" : "";
  const dimCode = isTty ? "\x1B[2m" : "";
  const out = [];
  out.push("");
  out.push(`${boldCode}\u26A1 AGQ HUD \u2014 Model Quota Monitor${resetCode}`);
  out.push(`${dimCode}Tier: ${resetCode}${boldCode}${summary.userTierName || "Standard"}${resetCode}${summary.userEmail ? ` ${dimCode}(${summary.userEmail})${resetCode}` : ""}`);
  out.push("");
  let targetList = verbose ? summary.allModels.map((m) => ({
    name: m.label,
    percentage: m.remainingPercentage,
    resetMs: m.timeUntilResetMs,
    limit5h: m.limit5h,
    limitWeekly: m.limitWeekly
  })) : summary.groups.map((g) => ({
    name: g.family,
    percentage: g.remainingPercentage,
    resetMs: g.timeUntilResetMs,
    limit5h: g.limit5h,
    limitWeekly: g.limitWeekly
  }));
  if (filter) {
    const f = filter.toLowerCase().trim();
    targetList = targetList.filter((item) => item.name.toLowerCase().includes(f));
    if (targetList.length === 0) {
      out.push(`${dimCode}No models matched filter: "${filter}"${resetCode}`);
      out.push("");
      return out.join("\n");
    }
  }
  const hasMultiWindow = targetList.some((item) => item.limit5h !== void 0 || item.limitWeekly !== void 0);
  if (hasMultiWindow) {
    const maxNameLen = Math.max(16, ...targetList.map((item) => item.name.length));
    const colName = maxNameLen + 2;
    const col5h = 14;
    const col1w = 14;
    const colReset5h = 14;
    const colReset1w = 14;
    const sep = "\u2500".repeat(colName + col5h + col1w + colReset5h + colReset1w + 5);
    out.push(sep);
    out.push(
      ` ${"Model".padEnd(colName)}${"5h Limit".padEnd(col5h)}${"Weekly Limit".padEnd(col1w)}${"Reset (5h)".padEnd(
        colReset5h
      )}${"Reset (1w)".padEnd(colReset1w)}`
    );
    out.push(sep);
    for (const item of targetList) {
      const nameCol = item.name.padEnd(colName);
      let p5hStr = "-";
      let color5h = "";
      if (item.limit5h) {
        const badge = getStatusBadge(item.limit5h.remainingPercentage);
        color5h = isTty ? badge.colorCode : "";
        p5hStr = `${item.limit5h.remainingPercentage.toFixed(1)}% ${badge.emoji}`;
      }
      const col5hText = `${color5h}${p5hStr.padEnd(col5h)}${resetCode}`;
      let pWStr = "-";
      let colorW = "";
      if (item.limitWeekly) {
        const badge = getStatusBadge(item.limitWeekly.remainingPercentage);
        colorW = isTty ? badge.colorCode : "";
        pWStr = `${item.limitWeekly.remainingPercentage.toFixed(1)}% ${badge.emoji}`;
      }
      const col1wText = `${colorW}${pWStr.padEnd(col1w)}${resetCode}`;
      const reset5hStr = item.limit5h ? formatTimeRemaining(item.limit5h.timeUntilResetMs) : "-";
      const resetWStr = item.limitWeekly ? formatTimeRemaining(item.limitWeekly.timeUntilResetMs) : "-";
      const reset5hCol = reset5hStr.padEnd(colReset5h);
      const resetWCol = resetWStr.padEnd(colReset1w);
      out.push(` ${nameCol}${col5hText}${col1wText}${reset5hCol}${resetWCol}`);
    }
    out.push(sep);
  } else {
    const maxNameLen = Math.max(16, ...targetList.map((item) => item.name.length));
    const colName = maxNameLen + 2;
    const colPct = 10;
    const colBar = 14;
    const colReset = 14;
    const sep = "\u2500".repeat(colName + colPct + colBar + colReset + 5);
    out.push(sep);
    out.push(
      ` ${"Model".padEnd(colName)}${"Remaining".padEnd(colPct)}${"Gauge".padEnd(colBar)}${"Resets In".padEnd(colReset)}`
    );
    out.push(sep);
    for (const item of targetList) {
      const badge = getStatusBadge(item.percentage);
      const color = isTty ? badge.colorCode : "";
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
  }
  if (!verbose && !filter && summary.allModels.length > summary.groups.length) {
    out.push(`${dimCode}Tip: Run with -v or --verbose to view all model sub-variants.${resetCode}`);
  }
  out.push("");
  return out.join("\n");
}

// src/index.ts
async function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    if (process.stdin.isTTY) {
      resolve("");
      return;
    }
    const timeout = setTimeout(() => {
      resolve(data);
    }, 1e3);
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => {
      clearTimeout(timeout);
      resolve(data);
    });
    process.stdin.on("error", () => {
      clearTimeout(timeout);
      resolve(data);
    });
  });
}
async function handleHookMode(flags) {
  try {
    const rawInput = await readStdin();
    let hookInput = {};
    if (rawInput.trim()) {
      try {
        hookInput = JSON.parse(rawInput);
      } catch {
      }
    }
    const conn = await detectConnection();
    if (!conn) {
      process.stdout.write("{}\n");
      return;
    }
    const { statusData, quotaSummaryData } = await fetchFullQuota(conn, 2500);
    const summary = parseQuotaSummary(statusData, quotaSummaryData);
    const markdown = formatHookMarkdown(summary, hookInput.modelName, {
      forceAll: flags.showAll
    });
    const title = formatHookTitle(summary, hookInput.modelName, {
      forceAll: flags.showAll
    });
    const output = {
      injectSteps: [
        {
          systemMessage: {
            systemMessage: markdown,
            renderInfo: {
              title,
              markdown
            }
          }
        }
      ],
      terminationBehavior: ""
    };
    process.stdout.write(JSON.stringify(output) + "\n");
  } catch {
    process.stdout.write("{}\n");
  }
}
async function handleCliMode(flags) {
  try {
    const conn = await detectConnection();
    if (!conn) {
      console.error("\u274C Could not connect to Antigravity Language Server.");
      console.error("   Please ensure Antigravity 2.0 / CLI / IDE is currently running.");
      process.exit(1);
    }
    const { statusData, quotaSummaryData } = await fetchFullQuota(conn, 4e3);
    const summary = parseQuotaSummary(statusData, quotaSummaryData);
    if (flags.json) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }
    const isTty = process.stdout.isTTY ?? true;
    const table = formatCliTable(summary, flags.verbose, isTty, flags.filter);
    console.log(table);
  } catch (err) {
    console.error(`\u274C Error fetching quota: ${err.message}`);
    process.exit(1);
  }
}
var VERSION = "0.0.1";
function printHelp() {
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
async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--version") || args.includes("-V")) {
    console.log(`agq-hud v${VERSION}`);
    return;
  }
  if (args.includes("--help") || args.includes("-h")) {
    printHelp();
    return;
  }
  const showAll = args.includes("--all") || args.includes("-a");
  if (args.includes("--hook")) {
    await handleHookMode({ showAll });
    return;
  }
  const verbose = args.includes("-v") || args.includes("--verbose");
  const json = args.includes("--json");
  const filter = args.find((arg) => !arg.startsWith("-"));
  await handleCliMode({ verbose, json, filter });
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
