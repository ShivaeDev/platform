import { DateTime, Option } from "effect";
import type { Holder } from "#holder.ts";

export function elapsed(fromMs: number, toMs: number): string {
	const seconds = Math.max(0, Math.round((toMs - fromMs) / 1000));
	const minutes = Math.floor(seconds / 60);
	return minutes > 0 ? `${minutes}m ${seconds % 60}s` : `${seconds}s`;
}

function localTime(ms: number): string {
	return Option.match(DateTime.make(ms), {
		onNone: () => "an unknown time",
		onSome: (time) => DateTime.formatLocal(time, { locale: "en-GB", timeStyle: "medium" }),
	});
}

export function waitingLine(holder: Holder, nowMs: number, mayBeHung = false): string {
	const branch = holder.branch === undefined ? "" : ` on branch ${holder.branch}`;
	const warning = mayBeHung ? "; holder may be hung" : "";
	return `heavy-process lock: waiting for pid ${holder.pid} running \`${holder.command}\` in ${holder.cwd}${branch} since ${localTime(holder.startedAtMs)} (${elapsed(holder.startedAtMs, nowMs)})${warning}`;
}

export function acquiredLine(waitStartedMs: number, nowMs: number): string {
	return `heavy-process lock: acquired after ${elapsed(waitStartedMs, nowMs)}`;
}

export const PS_MISSING_LINE = "heavy-process lock: ps is not on the PATH, so this command runs without the lock.";
