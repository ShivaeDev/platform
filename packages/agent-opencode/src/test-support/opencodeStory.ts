import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Fiber, Layer, Stream } from "effect";
import { requireFeatures } from "@shivaedev/agent/agent.ts";
import { Backend } from "@shivaedev/agent/backend.ts";
import type { BackendFailure } from "@shivaedev/agent/failures.ts";
import type { Receipt } from "@shivaedev/agent/run.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { opencode } from "#opencode.ts";
import { scriptedPeer } from "#test/peer.ts";

function input(text: string) {
	return { parts: [{ text, type: "text" as const }] as const };
}
export const openCode = storyKit({
	create: () =>
		Effect.gen(function* () {
			const peer = yield* scriptedPeer;
			const context = yield* Layer.build(opencode({ cwd: "/project", url: peer.url }));
			const backend = yield* Backend.pipe(Effect.provide(context));
			const agent = yield* requireFeatures(["sessions", "queuedInput", "steering", "interruption", "models"]).pipe(
				Effect.provideService(Backend, backend),
			);
			const receipts = new Map<string, Receipt>();
			const deliveries = new Map<string, Fiber.Fiber<void, BackendFailure>>();
			return { agent, deliveries, peer, receipts };
		}),
	layer: NodeServices.layer,
	name: "OpenCode protocol",
	outboundPassthrough: true,
	stages: ["backend"],
	verbs: (engine, story) => {
		function receipt(name: string) {
			const value = engine.receipts.get(name);
			if (value === undefined) {
				throw new Error(`no run ${name}`);
			}
			return value;
		}
		return {
			abort: (name: string) => engine.agent.interruption.interrupt(receipt(name)),
			closeEvents: engine.peer.closeEvents,
			delivered: (text: string) => {
				const fiber = engine.deliveries.get(text);
				return fiber === undefined ? Effect.die("delivery was never queued") : Fiber.join(fiber);
			},
			deliveryResult: (text: string) => {
				const fiber = engine.deliveries.get(text);
				return fiber === undefined
					? Effect.die("delivery was never queued")
					: Fiber.join(fiber).pipe(
							Effect.as("delivered"),
							Effect.catchTag("ProtocolFailure", (error) => Effect.succeed(error.message)),
						);
			},
			emit: engine.peer.emit,
			events: (name: string) =>
				engine.agent.events(receipt(name)).pipe(
					Stream.takeUntil((event) => event.raw?.kind === "story.barrier"),
					Stream.runCollect,
				),
			inspect: (name: string) => engine.agent.inspect(receipt(name)),
			models: () => engine.agent.models.list,
			queue: (name: string, text: string) =>
				Effect.gen(function* () {
					story.tell(`${name} queues ${text}`);
					engine.deliveries.set(
						text,
						yield* engine.agent.queuedInput.queue(receipt(name), input(text)).pipe(Effect.forkScoped({ startImmediately: true })),
					);
				}),
			reconcile: (name: string) => engine.agent.reconcile(name),
			request: () => engine.peer.request,
			resume: (name: string, session: string, text: string) =>
				Effect.gen(function* () {
					story.tell(`${name} resumes ${session}`);
					const result = yield* engine.agent.sessions.resume(
						{ value: session, version: 1 },
						{ cwd: "/project", input: input(text), operationId: name },
					);
					engine.receipts.set(name, result);
				}),
			start: (name: string, text: string, model?: string, effort?: string) =>
				Effect.gen(function* () {
					story.tell(`${name} starts ${text}`);
					const result = yield* engine.agent.start({
						cwd: "/project",
						input: input(text),
						operationId: name,
						...(model === undefined ? {} : { model }),
						...(effort === undefined ? {} : { effort }),
					});
					engine.receipts.set(name, result);
				}).pipe(
					Effect.catchTags({
						"Rejected": (error) => Effect.succeed({ outcome: "refused", providerCode: error.providerCode }),
						"UnknownAcceptance": (error) => Effect.succeed({ operationId: error.operationId, outcome: "acceptance unknown" }),
					}),
				),
			steer: (name: string, text: string) => engine.agent.steering.steer(receipt(name), input(text)),
		};
	},
});
export const lostAcknowledgement = openCode.trait("backend", "the peer drops prompt acknowledgements", (engine) => {
	engine.peer.promptResponse("drop");
});
export const refusedPrompt = openCode.trait("backend", "the peer refuses prompt delivery", (engine) => {
	engine.peer.promptResponse("refuse");
});
