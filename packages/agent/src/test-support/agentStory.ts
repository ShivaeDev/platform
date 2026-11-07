import { Effect, Stream } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { describe, requireFeatures } from "#agent.ts";
import { Backend } from "#backend.ts";
import type { Feature } from "#features.ts";
import type { Receipt } from "#run.ts";
import { scriptedBackend } from "#test/scriptedBackend.ts";

export const agent = storyKit({
	create: () => Effect.sync(scriptedBackend),
	name: "coding agent requirements",
	stages: ["backend"],
	verbs: (engine, story) => {
		function provide<A, E, R>(operation: Effect.Effect<A, E, R>) {
			return Effect.provideService(operation, Backend, engine.backend);
		}
		const receipt: Receipt = { backend: "scripted", operationId: "change", reference: { value: "run:change", version: 1 } };
		const input = { parts: [{ text: "keep the public API", type: "text" }] } as const;
		return {
			descriptor: () => provide(describe),
			inspectRun: () => {
				story.tell("the application inspects the run");
				return provide(requireFeatures([]).pipe(Effect.flatMap((facade) => facade.inspect(receipt)))).pipe(
					Effect.catchTag("BackendUnavailable", (error) => Effect.succeed({ outcome: "read unavailable", providerCode: error.providerCode })),
				);
			},
			providerCalls: () => Effect.sync(() => [...engine.calls]),
			queue: () => {
				story.tell("the application queues input");
				return provide(
					Effect.gen(function* () {
						const facade = yield* requireFeatures(["queuedInput"]);
						yield* facade.queuedInput.queue(receipt, input);
					}),
				);
			},
			readEvents: () => {
				story.tell("the application reads the run events");
				return provide(requireFeatures([]).pipe(Effect.flatMap((facade) => Stream.runCollect(facade.events(receipt)))));
			},
			reconcile: () => {
				story.tell("the application reconciles its operation id");
				return provide(requireFeatures([]).pipe(Effect.flatMap((facade) => facade.reconcile("change"))));
			},
			request: (requirements: readonly Feature[]) => {
				story.tell(`the application requires ${requirements.join(", ")}`);
				return provide(requireFeatures(requirements)).pipe(
					Effect.match({
						onFailure: (error) => ({ available: error.available, backend: error.backend, outcome: "unsupported", requirement: error.requirement }),
						onSuccess: () => ({ outcome: "available" }),
					}),
				);
			},
			start: () => {
				story.tell("the application submits a change");
				return provide(
					Effect.gen(function* () {
						const facade = yield* requireFeatures([]);
						return yield* facade.start({ cwd: "/project", input, operationId: "change" });
					}),
				).pipe(Effect.catchTag("UnknownAcceptance", (error) => Effect.succeed({ outcome: "unknown acceptance", providerCode: error.providerCode })));
			},
			steer: () => {
				story.tell("the application steers the run");
				return provide(
					Effect.gen(function* () {
						const facade = yield* requireFeatures(["steering", "queuedInput"]);
						yield* facade.steering.steer(receipt, input);
					}),
				);
			},
		};
	},
});

export function supporting(...features: readonly Feature[]) {
	return agent.trait("backend", `the backend supports ${features.join(", ")}`, (engine) => {
		for (const feature of features) {
			engine.supported.add(feature);
		}
	});
}
export const lostAcknowledgement = agent.trait("backend", "the provider accepts work but loses its acknowledgement", (engine) => {
	engine.script.acceptance = "unknown";
});
export function providerEvents(events: readonly unknown[]) {
	return agent.trait("backend", "the provider emits its event script", (engine) => {
		engine.script.events = [...events];
	});
}
export const missingEvidence = agent.trait("backend", "the provider has no execution evidence", (engine) => {
	engine.script.observation = { reason: "history expired", type: "missing" };
});
export const failedRead = agent.trait("backend", "the provider cannot answer reads", (engine) => {
	engine.script.readUnavailable = true;
});
export const rejectionProof = agent.trait("backend", "the provider proves the operation was refused", (engine) => {
	engine.script.proof = "operation refused before dispatch";
});
