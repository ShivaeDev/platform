import { Effect, Schema } from "effect";
import { configureCloud } from "#test/cloudHost.ts";
import type { WireRequest } from "#test/codex.ts";
import { cloudThread } from "#test/codexCloud.ts";
import { task } from "#test/fleetHost.ts";
import { HEAD } from "#test/githubResult.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";

const TurnInput = Schema.Struct({ clientUserMessageId: Schema.String });
const ItemInput = Schema.Struct({ turnId: Schema.String });
const states = new WeakMap<HostStoryEngine, ReturnType<typeof restartBackend>>();

export type RestartBoundary = "dispatch" | "answer" | "publication";

function restartBackend(boundary: RestartBoundary) {
	const answer = boundary === "answer";
	const accepted = Promise.withResolvers<void>();
	const acknowledgement = Promise.withResolvers<unknown>();
	const operations: string[] = [];
	const mutations: WireRequest[] = [];
	let finished = false;
	return {
		accepted: Effect.promise(() => accepted.promise).pipe(Effect.timeout("15 seconds")),
		acknowledge: () => acknowledgement.resolve({ turn: { id: "restart-turn-1" } }),
		finish: () => {
			finished = true;
		},
		handle(request: WireRequest) {
			switch (request.method) {
				case "thread/start":
					mutations.push(request);
					return { thread: { id: "restart-thread" } };
				case "thread/read":
					return { thread: { ...cloudThread().thread, id: "restart-thread" } };
				case "turn/start": {
					mutations.push(request);
					operations.push(Schema.decodeUnknownSync(TurnInput)(request.params).clientUserMessageId);
					if (boundary === "dispatch" && operations.length === 1) {
						accepted.resolve();
						return acknowledgement.promise;
					}
					if (answer && operations.length === 2) {
						accepted.resolve();
						return undefined;
					}
					return { turn: { id: `restart-turn-${operations.length}` } };
				}
				case "thread/turns/list":
					return {
						data: operations.map((operation, index) => ({
							id: `restart-turn-${index + 1}`,
							items: [{ clientId: operation, id: `input-${index}`, type: "userMessage" }],
							status: (answer && index === 0) || finished ? "completed" : "inProgress",
						})),
						nextCursor: null,
					};
				case "thread/items/list": {
					const { turnId } = Schema.decodeUnknownSync(ItemInput)(request.params);
					const text = answer && turnId === "restart-turn-1" ? "FLEET_QUESTION: Which storage?" : `Retained findings.\nFLEET_HEAD: ${HEAD}`;
					return { data: [{ item: { id: "final", phase: "final_answer", text, type: "agentMessage" } }], nextCursor: null };
				}
				default:
					return {};
			}
		},
		mutations,
	};
}

export function configureRestartCloud(engine: HostStoryEngine, boundary: RestartBoundary) {
	engine.externalProcess = true;
	engine.files = { "work.md": task("one", "approved").replace("fleet: approved", "fleet: approved\ndelivers: report") };
	engine.beforeFixture = Effect.gen(function* () {
		const backend = restartBackend(boundary);
		states.set(engine, backend);
		yield* configureCloud(engine, backend.handle, { requestTimeoutMs: 60_000 });
	});
}

export function restartCloudVerbs(engine: HostStoryEngine) {
	function state() {
		const value = states.get(engine);
		if (value === undefined) {
			throw new Error("Configure restart Cloud first");
		}
		return value;
	}
	return {
		acknowledgeRestartTurn: () => state().acknowledge(),
		awaitAcceptedTurn: () => state().accepted,
		finishRestartTurn: () => state().finish(),
		restartMutations: () => state().mutations,
	};
}
