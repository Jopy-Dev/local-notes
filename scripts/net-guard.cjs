"use strict";
/*
 * REQ-026 outbound-network guard: preloaded via NODE_OPTIONS --require by
 * scripts/test-package.mjs. Every non-loopback TCP connect attempt in the
 * launched process (worker threads included - NODE_OPTIONS applies to each
 * thread) is recorded to LOCAL_NOTES_NET_GUARD_LOG and refused, so the
 * acceptance run both simulates a disabled network and detects the attempt.
 * IPC/pipe connects stay allowed - they never leave the machine.
 */
const net = require("node:net");
const { appendFileSync } = require("node:fs");

const logPath = process.env.LOCAL_NOTES_NET_GUARD_LOG;

function isLoopback(host) {
  if (typeof host !== "string" || host.length === 0) return true; // default host = localhost
  const bare = host.replace(/^\[/, "").replace(/\]$/, "");
  return bare === "localhost" || bare === "::1" || bare.startsWith("127.");
}

function targetOf(args) {
  let first = args[0];
  // net.createConnection hands Socket.connect a normalized [options, cb]
  // array - unwrap it or every routed connect looks host-less (loopback).
  if (Array.isArray(first)) first = first[0];
  if (typeof first === "object" && first !== null) {
    if (first.path) return { ipc: true };
    return { host: first.host };
  }
  if (typeof first === "string") return { ipc: true }; // connect(path)
  return { host: typeof args[1] === "string" ? args[1] : undefined };
}

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function connectGuard(...args) {
  const target = targetOf(args);
  if (!target.ipc && !isLoopback(target.host)) {
    if (logPath) {
      try {
        appendFileSync(logPath, `connect ${target.host}\n`);
      } catch {
        /* guard logging must never crash the app under test */
      }
    }
    const host = target.host;
    queueMicrotask(() => this.destroy(new Error(`REQ-026: outbound network blocked (${host})`)));
    return this;
  }
  return originalConnect.apply(this, args);
};
