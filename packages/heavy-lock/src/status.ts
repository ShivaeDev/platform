import { DateTime } from "effect";
import type { Holder } from "./holder.ts";

export function elapsed(fromMs: number, toMs: number): string {
	const seconds = Math.max(0, Math.round((toMs - fromMs) / 1000));
	const minutes = Math.floor(seconds / 60);
	return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

function localTime(ms: number): string {
	return DateTime.formatLocal(DateTime.makeUnsafe(ms), { locale: "en-GB", timeStyle: "medium" });
}

export function waitingLine(holder: Holder, nowMs: number): string {
	return `heavy-process lock: waiting for pid ${holder.pid} running \`${holder.command}\` in ${holder.cwd} since ${localTime(holder.startedAtMs)} (${elapsed(holder.startedAtMs, nowMs)})`;
}

export function acquiredLine(waitStartedMs: number, nowMs: number): string {
	return `heavy-process lock: acquired after ${elapsed(waitStartedMs, nowMs)}`;
}
