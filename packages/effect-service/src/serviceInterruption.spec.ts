import { expect } from "@effect/vitest";
import { Cause, Context, Deferred, Effect, Exit, Fiber, Layer, Ref } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { defineService } from "#defineService.ts";

it.effect("interrupts a method and releases its caller resources while keeping the service live", function* () {
	class Resource extends Context.Service<Resource, string>()("test/InterruptedResource") {}
	const acquired = yield* Deferred.make<void>();
	const released = yield* Ref.make(0);
	const finalized = yield* Ref.make(0);
	const Service = defineService({
		id: "test/InterruptedMethod",
		initialize: Effect.addFinalizer(() => Ref.update(finalized, (count) => count + 1)),
		methods: () => ({
			read: () => Effect.map(Resource, (resource) => resource),
			wait: Effect.fn("InterruptedMethod.wait")(function* () {
				yield* Effect.acquireRelease(Resource, () => Ref.update(released, (count) => count + 1));
				yield* Deferred.succeed(acquired, undefined);
				return yield* Effect.never;
			}),
		}),
		requires: [Resource],
	});

	yield* Effect.gen(function* () {
		const service = yield* Service;
		const fiber = yield* Effect.scoped(service.wait()).pipe(Effect.forkChild);
		yield* Deferred.await(acquired);
		expect(yield* Ref.get(released)).toBe(0);
		yield* Fiber.interrupt(fiber);
		const exit = yield* Fiber.await(fiber);
		expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
		expect(yield* Ref.get(released)).toBe(1);
		expect(yield* Ref.get(finalized)).toBe(0);
		expect(yield* service.read()).toBe("resource");
	}).pipe(Effect.provide(Service.layer.pipe(Layer.provide(Layer.succeed(Resource, "resource")))));
	expect(yield* Ref.get(released)).toBe(1);
	expect(yield* Ref.get(finalized)).toBe(1);
});

it.effect("finalizes an interrupted Layer initialization once", function* () {
	const started = yield* Deferred.make<void>();
	const finalized = yield* Ref.make(0);
	const Service = defineService({
		id: "test/InterruptedInitialization",
		initialize: Effect.gen(function* () {
			yield* Effect.addFinalizer(() => Ref.update(finalized, (count) => count + 1));
			yield* Deferred.succeed(started, undefined);
			return yield* Effect.never;
		}),
		methods: () => ({ run: () => Effect.void }),
		requires: [],
	});
	const fiber = yield* Effect.scoped(Layer.build(Service.layer)).pipe(Effect.forkChild);
	yield* Deferred.await(started);
	expect(yield* Ref.get(finalized)).toBe(0);
	yield* Fiber.interrupt(fiber);
	const exit = yield* Fiber.await(fiber);
	expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
	expect(yield* Ref.get(finalized)).toBe(1);
	yield* Fiber.interrupt(fiber);
	expect(yield* Ref.get(finalized)).toBe(1);
});
