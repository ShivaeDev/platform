import { Clock, Effect, Schema } from "effect";
import { events } from "#events.ts";
import { type Diagnostic, makeOutput } from "#health.ts";
import type { Options, Snapshot, State } from "#model.ts";
import type { WatchEvent } from "#outputEvent.ts";
import { polling } from "#polling.ts";
import { requestFailure } from "#requestFailure.ts";
import type { WaitPending, WaitResult } from "#waitResult.ts";

export interface WaitOptions {
	readonly apiUrl: string;
	readonly number: number;
	readonly repository: string;
	readonly stateFile: string;
	readonly timeout?: number;
}

class WaitDeadline extends Schema.TaggedError<WaitDeadline>()("WaitDeadline", {}) {}

const passingStates = new Set(["clean", "unstable", "has_hooks"]);
const MINUTE_MILLIS = 60_000;

function verdict(before: Snapshot | undefined, after: Snapshot): WaitResult | WaitPending {
	const pr = { ...(after.head === undefined ? {} : { head: after.head }), number: after.number };
	const dequeued = events(before, after).find((event) => event.event === "dequeued");
	if (after.merged || after.state === "closed") {
		return { ...pr, result: after.merged ? "merged" : "closed" };
	}
	if (dequeued?.event === "dequeued") {
		return { ...pr, reason: dequeued.reason, result: "dequeued" };
	}
	if (after.queued) {
		return { ...pr, pending: "merge queue" };
	}
	if (after.dirty) {
		return { ...pr, result: "conflict" };
	}
	if (after.failed) {
		return { ...pr, checks: after.failedChecks ?? [], result: "checks-failed" };
	}
	if (passingStates.has(after.mergeableState ?? "")) {
		return { ...pr, result: "passed" };
	}
	return { ...pr, ...(after.mergeableState === undefined ? {} : { mergeableState: after.mergeableState }), pending: "required checks" };
}

function progressLine(status: WaitPending, lastError: string | undefined) {
	const state = status.mergeableState === undefined ? "" : ` (${status.mergeableState})`;
	return `Waiting for PR ${status.number}: ${status.pending}${state}${lastError === undefined ? "" : `; last poll failed: ${lastError}`}`;
}

export const waitFor = Effect.fn("PrWatch.waitFor")(function* <E, R>(wait: WaitOptions, diagnostic: Diagnostic<E, R>) {
	const options: Options = {
		apiUrl: wait.apiUrl,
		fleet: false,
		interval: MINUTE_MILLIS,
		numbers: [wait.number],
		repository: wait.repository,
		stateFile: wait.stateFile,
	};
	const key = String(wait.number);
	const deadline = wait.timeout === undefined ? undefined : (yield* Clock.currentTimeMillis) + wait.timeout;
	let status: WaitPending = { number: wait.number, pending: "observation" };
	const settlement: { result?: WaitResult } = {};
	let lastError: string | undefined;
	function settled(before: State, after: State) {
		const snapshot = after.prs[key];
		const observed = snapshot !== undefined && snapshot !== before.prs[key];
		if (snapshot === undefined || !(observed || snapshot.merged || snapshot.state === "closed")) {
			status = status.pending === "observation" ? { ...status, pending: "mergeability" } : status;
			return false;
		}
		const found = verdict(before.prs[key], snapshot);
		if ("result" in found) {
			settlement.result = found;
			return true;
		}
		status = found;
		return false;
	}
	const output = yield* makeOutput(
		(event: WatchEvent) => (event.event === "heartbeat" ? diagnostic(progressLine(status, lastError)) : Effect.void),
		MINUTE_MILLIS,
	);
	const waitForPoll = Effect.fnUntraced(function* (interval: number, delay: number, message?: string) {
		const now = yield* Clock.currentTimeMillis;
		if (deadline === undefined || now + delay < deadline) {
			return yield* output.waitForPoll(interval, delay, message);
		}
		yield* output.waitForPoll(interval, Math.max(0, deadline - now), message);
		return yield* new WaitDeadline();
	});
	const report = {
		error: (failure: unknown) =>
			Effect.sync(() => {
				lastError = requestFailure(failure).message;
			}),
		reset: () => {
			lastError = undefined;
		},
	};
	yield* polling(options, false, { emit: output.emit, waitForPoll }, report, settled).pipe(Effect.catchTag("WaitDeadline", () => Effect.void));
	return settlement.result ?? { ...status, result: "timeout" as const };
});
