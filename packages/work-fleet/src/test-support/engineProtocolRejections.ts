import { Clock, Context, Effect, Layer } from "effect";
import { SessionTransport } from "#session/service.ts";
import { codexConfiguration, codexServer, WireRejection, type WireRequest } from "#test/codex.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { rejectionBackoff } from "#test/rejectionBackoff.ts";

export const GENERIC_REJECTION_MESSAGE = "Something went wrong. Request ID: synthetic-request";
export interface ProtocolRejections {
	backoff?: Effect.Success<typeof rejectionBackoff>;
	requests: WireRequest[];
	times: number[];
}
export const protocolRejectionOptions = Effect.fn("FleetStory.protocolRejectionOptions")(function* (state: EngineStory, failure: number | string) {
	const clock = yield* Clock.Clock;
	const backoff = typeof failure === "number" ? yield* rejectionBackoff : undefined;
	const protocol: ProtocolRejections = { requests: [], times: [], ...(backoff === undefined ? {} : { backoff }) };
	state.protocolRejections = protocol;
	const server = yield* codexServer((request) => protocolReply(protocol, failure, request, clock.currentTimeMillisUnsafe()));
	const transport = Context.get(yield* Layer.build(codexConfiguration(server.endpoint)), SessionTransport);
	const observedTransport =
		backoff === undefined
			? transport
			: {
					...transport,
					startTurn: (input: Parameters<typeof SessionTransport.Service.startTurn>[0]) =>
						transport.startTurn(input).pipe(Effect.provideService(Clock.Clock, backoff.clock)),
				};
	return { decorateTransport: () => observedTransport, now: () => clock.currentTimeMillisUnsafe() };
});
export function engineProtocolVerbs(state: EngineStory, tell: (line: string) => void) {
	function protocol() {
		if (state.protocolRejections === undefined) {
			throw new Error("No Codex rejection fixture is configured");
		}
		return state.protocolRejections;
	}
	return {
		advanceProtocolBackoff: (index: 0 | 1) => {
			const backoff = protocol().backoff;
			if (backoff === undefined) {
				throw new Error("No rejection backoff is configured");
			}
			tell(`advance protocol retry ${index + 1}`);
			return backoff.advance(index);
		},
		protocolRequests: () => [...protocol().requests],
		protocolSubmissionTimes: () => [...protocol().times],
		waitForProtocolOutcome: () =>
			Effect.gen(function* () {
				tell("wait for Fleet's protocol receipt or decision");
				while (true) {
					const record = (yield* running(state).fleet.get("one")).value;
					if (record.decision?.published !== undefined || record.attempts[0]?.receipt !== undefined) {
						return record;
					}
					yield* Effect.yieldNow;
				}
			}),
	};
}

function protocolReply(protocol: ProtocolRejections, failure: number | string, request: WireRequest, now: number) {
	protocol.requests.push(request);
	if (request.method === "thread/start") {
		return { thread: { id: "worker-thread" } };
	}
	if (request.method !== "turn/start") {
		const data = typeof failure === "number" ? [] : [{ id: "active", items: [], status: "inProgress" }];
		return { data, nextCursor: null };
	}
	protocol.times.push(now);
	if (typeof failure === "number" && protocol.times.length > failure) {
		return { turn: { id: "worker-turn" } };
	}
	return new WireRejection(typeof failure === "string" ? failure : GENERIC_REJECTION_MESSAGE);
}
