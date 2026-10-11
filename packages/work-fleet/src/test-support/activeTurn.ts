import { Deferred, Effect, Schema } from "effect";
import { codexAdapter } from "#providers/codexAdapter.ts";
import { failure } from "#providers/codexRpc.ts";
import type { CodexRequest } from "#providers/codexTurns.ts";
import type { ContinueSession } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";

const Page = Schema.Struct({ cursor: Schema.NullOr(Schema.String) });

export const activeTurn = Effect.fn("Test.activeTurn")(function* () {
	const waiting = yield* Deferred.make<void>();
	const submissions: unknown[] = [];
	let active = false;
	function listTurns(params: unknown) {
		return Effect.gen(function* () {
			const { cursor } = yield* Schema.decodeUnknownEffect(Page)(params).pipe(
				Effect.mapError(() => failure("protocol", "Invalid synthetic pagination request")),
			);
			if (cursor === null) {
				return { data: [{ id: "finished-turn", items: [], status: "completed" }], nextCursor: "active-page" };
			}
			yield* Deferred.succeed(waiting, undefined);
			return { data: [{ id: "steered-turn", items: [], status: active ? "inProgress" : "completed" }], nextCursor: null };
		});
	}
	function submit(transport: typeof SessionTransport.Service, input: ContinueSession, params: unknown) {
		return Effect.gen(function* () {
			submissions.push(params);
			if (active) {
				return yield* failure("rejected", "Codex rejected the protocol request: turn already active for thread");
			}
			const receipt = yield* transport.startTurn(input);
			return { turn: { id: receipt.turnId } };
		});
	}
	function decorateTransport(transport: typeof SessionTransport.Service): typeof SessionTransport.Service {
		return {
			...transport,
			startTurn: (input) => {
				const rpc: CodexRequest = (method, params) => {
					switch (method) {
						case "turn/start":
							return submit(transport, input, params);
						case "thread/turns/list":
							return listTurns(params);
						default:
							return Effect.fail(failure("protocol", "Unexpected synthetic provider request"));
					}
				};
				return codexAdapter(rpc, { beforeTurn: () => Effect.succeed({}), provisioning: "ready", threadStart: () => ({}) }).startTurn(input);
			},
		};
	}
	return {
		activate: () => {
			active = true;
		},
		complete: () => {
			active = false;
		},
		decorateTransport,
		submissions,
		waiting: Deferred.await(waiting),
	};
});
