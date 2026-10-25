import { Effect, Schema } from "effect";
import { configureCloud } from "#test/cloudHost.ts";
import type { WireRequest } from "#test/codex.ts";
import { cloudThread } from "#test/codexCloud.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

const ItemRequest = Schema.Struct({ turnId: Schema.String });
const states = new WeakMap<HostStoryEngine, { requests: WireRequest[]; firstTurn: (turnId: string) => void; finish: () => void }>();
export function configureContinuationCloud(engine: HostStoryEngine) {
	engine.beforeFixture = Effect.gen(function* () {
		const requests: WireRequest[] = [];
		let firstTurn = "";
		let terminal = false;
		let started = false;
		yield* configureCloud(engine, (request) => {
			requests.push(request);
			switch (request.method) {
				case "thread/read":
					return cloudThread();
				case "turn/start":
					started = true;
					return { turn: { id: "continued-turn" } };
				case "thread/turns/list":
					return continuationTurns(firstTurn, started, terminal);
				case "thread/items/list": {
					const text = Schema.decodeUnknownSync(ItemRequest)(request.params).turnId === "continued-turn" ? "Repaired result" : "Original result";
					return { data: [{ item: { id: "final", phase: "final_answer", text, type: "agentMessage" } }], nextCursor: null };
				}
				default:
					return {};
			}
		});

		states.set(engine, {
			finish: () => {
				terminal = true;
			},
			firstTurn: (turnId) => {
				firstTurn = turnId;
			},
			requests,
		});
	});
}
export function continuationCloudVerbs(engine: HostStoryEngine) {
	function state() {
		const value = states.get(engine);
		if (value === undefined) {
			throw new Error("Configure Cloud continuation first");
		}
		return value;
	}
	return {
		continuationRequests: () => state().requests,
		finishContinuedCloudTurn: () => state().finish(),
		originalCloudTurn: (turnId: string) => state().firstTurn(turnId),
	};
}

function continuationTurns(firstTurn: string, started: boolean, terminal: boolean) {
	return {
		data: [
			{ id: firstTurn, items: [], status: "completed" },
			...(started ? [{ id: "continued-turn", items: [], status: terminal ? "completed" : "inProgress" }] : []),
		],
		nextCursor: null,
	};
}
