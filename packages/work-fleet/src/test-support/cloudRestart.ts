import { Effect, Schema } from "effect";
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
	const sessions: string[] = [];
	const turns: string[] = [];
	let operationId: unknown;
	let reached = false;
	const boundaryReached = Promise.withResolvers<void>();
	function reach() {
		reached = true;
		boundaryReached.resolve();
	}
	let scans = 0;
	let retry = false;
	let acknowledge: ((value: unknown) => void) | undefined;
	function threadStart() {
		if (boundary === "before-thread" || boundary === "after-thread") {
			reach();
		}
		if (boundary === "before-thread") {
			return undefined;
		}
		sessions.push("synthetic-session");
		return boundary === "after-thread" ? undefined : { thread: { id: "synthetic-session" } };
	}
	function turnStart(request: WireRequest) {
		reach();
		operationId = Schema.decodeUnknownSync(Schema.Struct({ clientUserMessageId: Schema.String }))(request.params).clientUserMessageId;
		if ((boundary === "before-turn" || boundary === "retry") && !retry && requests.filter(({ method }) => method === "turn/start").length === 1) {
			return undefined;
		}
		if (boundary === "late-turn") {
			return new Promise((resolve) => {
				acknowledge = resolve;
			});
		}
		turns.push("synthetic-turn");
		return boundary === "after-turn" ? undefined : { turn: { id: "synthetic-turn" } };
	}
	function turnList() {
		scans += 1;
		if (boundary === "late-turn" && scans === 3) {
			turns.push("synthetic-turn");
			acknowledge?.({ turn: { id: "synthetic-turn" } });
		}
		const data =
			turns.length === 0
				? []
				: [{ id: "synthetic-turn", items: [{ clientId: operationId, id: "input", type: "userMessage" }], status: "inProgress" }];
		return { data, nextCursor: null };
	}
	return {
		allowRetry() {
			retry = true;
		},
		boundaryReached: Effect.promise(() => boundaryReached.promise),
		handle(request: WireRequest) {
			requests.push(request);
			switch (request.method) {
				case "thread/start":
					return threadStart();
				case "thread/read":
					if (["before-turn-request", "changed-context", "revoked-approval"].includes(boundary) && !reached) {
						reach();
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
		requests,
		sessions,
		turns,
	};
}

export function hostRecord(fixture: HostFixture) {
	return Effect.gen(function* () {
		return (yield* (yield* Fleet).get("synthetic-work")).value;
	}).pipe(Effect.provide(hostLayer(fixture.host, { ...fixture.parts, provider: hostProvider(fixture.host) })));
}
