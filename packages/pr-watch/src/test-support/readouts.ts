import type { Snapshot } from "#model.ts";
import type { Received } from "./server.ts";

interface Printed {
	readonly at?: string;
	readonly branch?: string;
	readonly delayMs?: number;
	readonly event: string;
	readonly message?: string;
	readonly nextPollAt?: string;
	readonly number?: number;
	readonly reason?: string;
	readonly title?: string;
}

export function clockTime(at: string | number) {
	return new Date(at).toISOString().slice(11, 19);
}

function parsed(line: string): Printed | undefined {
	try {
		return JSON.parse(line);
	} catch {
		return undefined;
	}
}

export function described(line: string) {
	const printed = parsed(line);
	if (printed === undefined) {
		return line;
	}
	if (printed.number !== undefined) {
		return `PR ${printed.number} ${printed.event}`;
	}
	return printed.event === "stopped" ? `stopped: ${printed.reason}` : printed.event;
}

export function healthOf(lines: readonly string[], event: string) {
	return lines.flatMap((line) => {
		const printed = parsed(line);
		return printed?.event === event && printed.number === undefined ? [printed] : [];
	});
}

export function heartbeat({ at = "", nextPollAt = "" }: Printed) {
	return `${clockTime(at)}, next poll ${clockTime(nextPollAt)}`;
}

export function cooldown({ at = "", message, nextPollAt = "" }: Printed) {
	return `${clockTime(at)} until ${clockTime(nextPollAt)}: ${message}`;
}

export function transitionLines(lines: readonly string[]) {
	return lines.flatMap((line) => {
		const printed = parsed(line);
		return printed?.number === undefined ? [] : [printed];
	});
}

export function snapshotPhrase(snapshot: Snapshot | undefined) {
	if (snapshot === undefined) {
		return "none";
	}
	return [
		snapshot.merged ? "merged" : snapshot.state,
		...(snapshot.autoMerge ? ["auto-merge"] : []),
		...(snapshot.queued ? ["queued"] : []),
		...(snapshot.dirty ? ["conflict"] : []),
		...(snapshot.failed ? ["failing checks"] : []),
	].join(", ");
}

export function request({ method, path, status }: Received) {
	return `${method} ${path} ${status}`;
}
