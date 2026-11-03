import type { Snapshot } from "#model.ts";
import type { HealthEvent, WatchEvent } from "#outputEvent.ts";
import type { Received } from "./server.ts";

export function clockTime(at: string | number) {
	return new Date(at).toISOString().slice(11, 19);
}

export function described(printed: WatchEvent) {
	if ("number" in printed) {
		return `PR ${printed.number} ${printed.event}`;
	}
	return printed.event === "stopped" ? `stopped: ${printed.reason}` : printed.event;
}

export function healthOf<TKind extends HealthEvent["event"]>(values: readonly WatchEvent[], event: TKind) {
	return values.filter((value): value is Extract<HealthEvent, { readonly event: TKind }> => value.event === event);
}

export function heartbeat({ at, nextPollAt }: Extract<HealthEvent, { readonly event: "heartbeat" }>) {
	return `${clockTime(at)}, next poll ${clockTime(nextPollAt)}`;
}

export function cooldown({ at, message, nextPollAt }: Extract<HealthEvent, { readonly event: "cooldown" }>) {
	return `${clockTime(at)} until ${clockTime(nextPollAt)}: ${message}`;
}

export function transitionLines(values: readonly WatchEvent[]) {
	return values.filter((value) => "number" in value);
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
