import { expect } from "@effect/vitest";
import { Context, Data, Effect, Exit, Layer, Ref } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { defineService } from "#define-service.ts";

class InitializationFailed extends Data.TaggedError("InitializationFailed") {}
class MethodFailed extends Data.TaggedError("MethodFailed") {}

it.effect("fails the Layer build with the initializer error and finalizes its partial acquisition", function* () {
	const failure = new InitializationFailed();
	const finalized = yield* Ref.make(0);
	let factoryCalls = 0;
	const Service = defineService({
		id: "test/FailedInitialization",
		initialize: Effect.gen(function* () {
			yield* Effect.addFinalizer(() => Ref.update(finalized, (count) => count + 1));
			return yield* Effect.fail(failure);
		}),
		methods: () => {
			factoryCalls += 1;
			return { run: () => Effect.void };
		},
		requires: [],
	});

	expect(yield* Effect.scoped(Layer.build(Service.layer)).pipe(Effect.flip)).toBe(failure);
	expect(yield* Ref.get(finalized)).toBe(1);
	expect(factoryCalls).toBe(0);
});

it.effect("returns a method's typed failure to the caller and serves the next call on the same instance", function* () {
	class Prefix extends Context.Service<Prefix, string>()("test/FailurePrefix") {}
	const failure = new MethodFailed();
	const Service = defineService({
		id: "test/MethodFailure",
		initialize: Ref.make(0),
		methods: (calls) => ({
			run: Effect.fn("MethodFailure.run")(function* (fail: boolean) {
				const prefix = yield* Prefix;
				const call = yield* Ref.updateAndGet(calls, (count) => count + 1);
				if (fail) {
					return yield* Effect.fail(failure);
				}
				return `${prefix}${call}`;
			}),
		}),
		requires: [Prefix],
	});

	yield* Effect.gen(function* () {
		const service = yield* Service;
		expect(yield* service.run(true).pipe(Effect.flip)).toBe(failure);
		expect(yield* service.run(false)).toBe("call 2");
	}).pipe(Effect.provide(Service.layer.pipe(Layer.provide(Layer.succeed(Prefix, "call ")))));
});

it.effect("keeps a method defect in the defect channel", function* () {
	const defect = new Error("method defect");
	const Service = defineService({
		id: "test/MethodDefect",
		initialize: Effect.void,
		methods: () => ({ crash: () => Effect.die(defect) }),
		requires: [],
	});

	const exit = yield* Service.pipe(
		Effect.flatMap((service) => Effect.exit(service.crash())),
		Effect.provide(Service.layer),
	);
	expect(exit).toEqual(Exit.die(defect));
});
