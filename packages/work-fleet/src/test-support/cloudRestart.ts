import { Clock, Effect, Schema } from "effect";
import { Fleet } from "#fleet.ts";
import { hostLayer } from "#host/commands.ts";
import { hostProvider } from "#host/providers.ts";
import type { WireRequest } from "#test/codex.ts";
import { cloudThread } from "#test/codexCloud.ts";
import type { HostFixture } from "#test/fleetHost.ts";

export type Boundary =
	| "before-thread"
	| "after-thread"
	| "changed-context"
	| "revoked-approval"
	| "before-turn-request"
	| "before-turn"
	| "after-turn"
	| "late-turn"
	| "retry"
	| "acknowledged-turn";
export function restartBackend(boundary: Boundary) {
	const requests: WireRequest[] = [];
	let sessions = 0;
	let turns = 0;
	let operationId: unknown;
	let reached = false;
	let scans = 0;
	let retry = false;
	let acknowledge: ((value: unknown) => void) | undefined;
	function threadStart() {
		reached = boundary === "before-thread" || boundary === "after-thread";
		if (boundary === "before-thread") {
			return undefined;
		}
		sessions += 1;
		return boundary === "after-thread" ? undefined : { thread: { id: "synthetic-session" } };
	}
	function turnStart(request: WireRequest) {
		reached = true;
		operationId = Schema.decodeUnknownSync(Schema.Struct({ clientUserMessageId: Schema.String }))(request.params).clientUserMessageId;
		if ((boundary === "before-turn" || boundary === "retry") && !retry && requests.filter(({ method }) => method === "turn/start").length === 1) {
			return undefined;
		}
		if (boundary === "late-turn") {
			return new Promise((resolve) => {
				acknowledge = resolve;
			});
		}
		turns += 1;
		return boundary === "after-turn" ? undefined : { turn: { id: "synthetic-turn" } };
	}
	function turnList() {
		scans += 1;
		if (boundary === "late-turn" && scans === 3) {
			turns += 1;
			acknowledge?.({ turn: { id: "synthetic-turn" } });
		}
		const data =
			turns === 0 ? [] : [{ id: "synthetic-turn", items: [{ clientId: operationId, id: "input", type: "userMessage" }], status: "inProgress" }];
		return { data, nextCursor: null };
	}
	return {
		allowRetry() {
			retry = true;
		},
		handle(request: WireRequest) {
			requests.push(request);
			switch (request.method) {
				case "thread/start":
					return threadStart();
				case "thread/read":
					if (["before-turn-request", "changed-context", "revoked-approval"].includes(boundary) && !reached) {
						reached = true;
						return undefined;
					}
					return cloudThread();
				case "turn/start":
					return turnStart(request);
				case "thread/turns/list":
					return turnList();
				case "thread/items/list":
					return { data: [], nextCursor: null };
				default:
					return {};
			}
		},
		get reached() {
			return reached;
		},
		requests,
		get sessions() {
			return sessions;
		},
		get turns() {
			return turns;
		},
	};
}

interface Progress {
	readonly done: boolean;
	readonly progress: number;
}

export const until = Effect.fn("CloudRestart.until")(function* (condition: () => Effect.Effect<boolean | Progress, unknown>) {
	let deadline = (yield* Clock.currentTimeMillis) + 20_000;
	let progress = 0;
	while (true) {
		const observed = yield* condition();
		if (typeof observed === "boolean" ? observed : observed.done) {
			return;
		}
		const now = yield* Clock.currentTimeMillis;
		if (typeof observed !== "boolean" && observed.progress > progress) {
			progress = observed.progress;
			deadline = now + 20_000;
		}
		if (now >= deadline) {
			return yield* Effect.die(new Error(`Restart progress stalled at ${progress} for 20 seconds`));
		}
		yield* Effect.sleep("20 millis");
	}
});

export function hostRecord(fixture: HostFixture) {
	return Effect.gen(function* () {
		return (yield* (yield* Fleet).get("synthetic-work")).value;
	}).pipe(Effect.provide(hostLayer(fixture.host, { ...fixture.parts, provider: hostProvider(fixture.host) })));
}
