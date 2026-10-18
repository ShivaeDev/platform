import { expect } from "@effect/vitest";
import { Cause, Context, Deferred, Effect, Exit, Fiber, Layer, Ref, Scope } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { defineService } from "#defineService.ts";

it.effect("runs initialization finalizers once when the Layer scope is explicitly closed", function* () {
	const finalized = yield* Ref.make(0);
	const Service = defineService({
		id: "test/ClosedLayer",
		initialize: Effect.addFinalizer(() => Ref.update(finalized, (count) => count + 1)),
		methods: () => ({ run: () => Effect.succeed("live") }),
		requires: [],
	});
	const scope = yield* Scope.make();
	const context = yield* Layer.buildWithScope(Service.layer, scope);
	expect(yield* Context.get(context, Service).run()).toBe("live");
	expect(yield* Ref.get(finalized)).toBe(0);
	yield* Scope.close(scope, Exit.void);
	expect(yield* Ref.get(finalized)).toBe(1);
	yield* Scope.close(scope, Exit.void);
	expect(yield* Ref.get(finalized)).toBe(1);
});

it.effect("runs initialization finalizers once when the live Layer's owner is interrupted", function* () {
	const started = yield* Deferred.make<void>();
	const finalized = yield* Ref.make(0);
	const Service = defineService({
		id: "test/InterruptedLayerOwner",
		initialize: Effect.addFinalizer(() => Ref.update(finalized, (count) => count + 1)),
		methods: () => ({ run: () => Deferred.succeed(started, undefined) }),
		requires: [],
	});
	const fiber = yield* Effect.gen(function* () {
		const service = yield* Service;
		yield* service.run();
		return yield* Effect.never;
	}).pipe(Effect.provide(Service.layer), Effect.forkChild);
	yield* Deferred.await(started);
	expect(yield* Ref.get(finalized)).toBe(0);
	yield* Fiber.interrupt(fiber);
	const exit = yield* Fiber.await(fiber);
	expect(Exit.isFailure(exit) && Cause.hasInterruptsOnly(exit.cause)).toBe(true);
	expect(yield* Ref.get(finalized)).toBe(1);
	yield* Fiber.interrupt(fiber);
	expect(yield* Ref.get(finalized)).toBe(1);
});
