import { Clock, Effect } from "effect";
import { quietPrEvent } from "#host/actionableWatch.ts";

export interface WatchLine {
	readonly kind: string;
	readonly [key: string]: unknown;
}

export function watchAttention() {
	const seen = new Set<string>();
	let outageAt: number | undefined;
	let outageReported = false;
	const accept = Effect.fnUntraced(function* (event: WatchLine) {
		if (event.kind === "daemon-unreachable") {
			outageAt ??= yield* Clock.currentTimeMillis;
			return false;
		}
		if (event.kind === "daemon-back") {
			outageAt = undefined;
			const reported = outageReported;
			outageReported = false;
			return reported;
		}
		if (quietPrEvent(event)) {
			return false;
		}
		if (event.workId === undefined && event.kind !== "pr-error") {
			return true;
		}
		const key = JSON.stringify([event.kind, event.workId, event.head, event.pr, event.reason ?? event.message]);
		if (seen.has(key)) {
			return false;
		}
		seen.add(key);
		return true;
	});
	return {
		accept,
		outage: Effect.gen(function* () {
			if (outageAt === undefined || outageReported) {
				return false;
			}
			if ((yield* Clock.currentTimeMillis) - outageAt < 60_000) {
				return false;
			}
			outageReported = true;
			return true;
		}),
	};
}
