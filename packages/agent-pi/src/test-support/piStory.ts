import { Context, Deferred, Effect, Exit, Fiber, Layer, Scope, Stream } from "effect";
import { requireFeatures } from "@shivaedev/agent/agent.ts";
import { Backend } from "@shivaedev/agent/backend.ts";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import type { ReadFailure } from "@shivaedev/agent/failures.ts";
import type { Receipt, StartRequest } from "@shivaedev/agent/run.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { piLayer } from "#piLayer.ts";
import { scriptedPi } from "./scriptedPi.ts";

function initialReceipt(): Receipt | undefined {
	return undefined;
}
export const pi = storyKit({
	create: () =>
		Effect.gen(function* () {
			const peer = yield* Effect.acquireRelease(Effect.sync(scriptedPi), (runtime) => Effect.sync(runtime.cleanup));
			const scope = yield* Scope.make();
			yield* Effect.addFinalizer((exit) => Scope.close(scope, exit));
			const context = yield* Layer.buildWithScope(piLayer({ additionalSkillPaths: ["/application/skills"] }), scope);
			const backend = Context.get(context, Backend);
			return { backend, context, peer, receipt: initialReceipt(), scope };
		}),
	name: "Pi coding agent",
	stages: ["provider"],
	verbs: (engine, story) => {
		let watched: Fiber.Fiber<readonly RunEvent[], ReadFailure> | undefined;
		function provide<A, E, R>(effect: Effect.Effect<A, E, R>) {
			return effect.pipe(Effect.provideService(Scope.Scope, engine.scope));
		}
		function request(text: string, model?: string, effort?: string): StartRequest {
			return {
				cwd: engine.peer.directory,
				effort,
				input: { parts: [{ text, type: "text" }] },
				model,
				operationId: text,
			};
		}
		function receipt() {
			if (engine.receipt === undefined) {
				throw new Error("Start the Pi run before using it");
			}
			return engine.receipt;
		}
		function remember(value: Receipt) {
			return Effect.sync(() => {
				engine.receipt = value;
			});
		}
		function start(text = "Build an app", model?: string, effort?: string) {
			return provide(engine.backend.start(request(text, model, effort))).pipe(Effect.tap(remember));
		}
		const resume = Effect.gen(function* () {
			const agent = yield* features;
			const reference = receipt().session;
			if (reference === undefined) {
				return yield* Effect.die("Pi did not return a persisted session reference");
			}
			return yield* provide(agent.sessions.resume(reference, request("Continue the app"))).pipe(Effect.tap(remember));
		});
		const features = Effect.suspend(() =>
			requireFeatures(["sessions", "queuedInput", "steering", "interruption", "models"]).pipe(Effect.provideService(Backend, engine.backend)),
		);
		return {
			accept: () => Effect.sync(engine.peer.accept),
			begin: () => {
				story.tell("the application starts a run");
				return start().pipe(
					Effect.forkScoped,
					Effect.tap(() => Effect.promise(() => engine.peer.prompted)),
				);
			},
			calls: () => Effect.sync(() => [...engine.peer.calls]),
			dispose: () => {
				story.tell("the application closes the runtime scope");
				return Scope.close(engine.scope, Exit.void);
			},
			emit: (event: Parameters<typeof engine.peer.emit>[0]) => Effect.sync(() => engine.peer.emit(event)),
			events: (count: number) => Stream.runCollect(engine.backend.events(receipt()).pipe(Stream.take(count))),
			inspect: () => engine.backend.inspect(receipt()),
			interrupt: () => features.pipe(Effect.flatMap((agent) => agent.interruption.interrupt(receipt()))),
			join: <A, E>(fiber: Fiber.Fiber<A, E>) => Fiber.join(fiber),
			loseSessionFile: () =>
				Effect.sync(() => {
					const reference = receipt().session;
					if (reference === undefined) {
						throw new Error("No session file to remove");
					}
					engine.peer.removeFile(reference.value);
				}),
			models: () => features.pipe(Effect.flatMap((agent) => agent.models.list)),
			opened: () => Effect.sync(() => [...engine.peer.opened]),
			queue: (text: string) => features.pipe(Effect.flatMap((agent) => agent.queuedInput.queue(receipt(), { parts: [{ text, type: "text" }] }))),
			reconcile: (operationId: string) => engine.backend.reconcile(operationId),
			released: () => Effect.sync(engine.peer.released),
			resources: () => Effect.sync(() => [...engine.peer.resourceRequests]),
			restart: () =>
				Effect.gen(function* () {
					const scope = yield* Scope.make();
					yield* Effect.addFinalizer((exit) => Scope.close(scope, exit));
					engine.scope = scope;
					engine.context = yield* Layer.buildWithScope(piLayer({ additionalSkillPaths: ["/application/skills"] }), scope);
					engine.backend = Context.get(engine.context, Backend);
				}),
			resume: () => resume,
			resumeRefusal: () => resume.pipe(Effect.catchTag("Rejected", (error) => Effect.succeed({ outcome: "rejected", reason: error.message }))),

			start,
			startRefusal: (model?: string, effort?: string) =>
				start("Refused", model, effort).pipe(Effect.catchTag("Rejected", (error) => Effect.succeed({ outcome: "rejected", reason: error.message }))),
			steer: (text: string) => features.pipe(Effect.flatMap((agent) => agent.steering.steer(receipt(), { parts: [{ text, type: "text" }] }))),
			unsupported: (feature: "imageInput" | "transcript") =>
				requireFeatures([feature]).pipe(
					Effect.provide(engine.context),
					Effect.catchTag("UnsupportedCapability", (error) => Effect.succeed({ outcome: "unsupported", requirement: error.requirement })),
				),
			watch: (count?: number) =>
				Effect.gen(function* () {
					const ready = yield* Deferred.make<void>();
					const events = engine.backend.events(receipt()).pipe(Stream.tap(() => Deferred.succeed(ready, undefined)));
					watched = yield* Stream.runCollect(count === undefined ? events : events.pipe(Stream.take(count))).pipe(Effect.forkScoped);
					yield* Deferred.await(ready);
				}),
			watchedEvents: () => (watched === undefined ? Effect.die("Start watching events first") : Fiber.join(watched)),
		};
	},
});
export const heldPreflight = pi.trait("provider", "Pi has not accepted the prompt yet", (engine) => engine.peer.holdPreflight());
export const refusedPreflight = pi.trait("provider", "Pi refuses during preflight", (engine) => engine.peer.refuse("compaction in progress"));
export const noCredentials = pi.trait("provider", "Pi has no credential-backed models", (engine) => {
	engine.peer.catalog.length = 0;
});
export const noSessionFile = pi.trait("provider", "Pi opens without a persisted file", (engine) => engine.peer.omitFile());
