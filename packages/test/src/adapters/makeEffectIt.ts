import type { TestOptions } from "@effect/vitest";
import * as Effect from "effect/Effect";
import type * as Layer from "effect/Layer";
import { effectOf } from "#internal/effectOf.ts";
import type { EffectClock, EffectTest, EffectTester, EffectTestOptions, MakeEffectItOptions, MakeEffectItResult } from "#types.ts";
import type { AnyTestLayer } from "./anyTestLayer.ts";
import { fixtureIt } from "./fixtureIt.ts";

function splitOptions(options: number | EffectTestOptions | undefined): {
	readonly vitest: TestOptions;
	readonly clock: EffectClock | undefined;
} {
	if (typeof options === "number") {
		return { clock: undefined, vitest: { timeout: options } };
	}
	const { clock, ...vitest } = options ?? {};
	return { clock, vitest };
}

export function makeEffectIt<THarness, TTestLayer extends AnyTestLayer>(
	options: MakeEffectItOptions<THarness, TTestLayer>,
): MakeEffectItResult<THarness, Layer.Success<TTestLayer>> {
	type Provided = Layer.Success<TTestLayer>;
	const tests = fixtureIt<THarness, TTestLayer>(options.layer, (body, context, services) => {
		const ready = Effect.gen(function* () {
			const harness = yield* options.makeHarness(context);
			return yield* effectOf(body)(harness, context);
		});
		const wrapped = options.around?.(ready) ?? ready;
		return wrapped.pipe(Effect.provide(services));
	});
	const defaultClock = options.clock ?? "test";

	function register(current: typeof tests.fails): EffectTest<THarness, Provided> {
		return (name, body, testOptions) => {
			const split = splitOptions(testOptions);
			current(name, split.vitest, ({ __effectTestRun }) => __effectTestRun(body, split.clock ?? defaultClock));
		};
	}

	const each: EffectTester<THarness, Provided>["each"] = (cases) => (name, body, testOptions) => {
		const split = splitOptions(testOptions);
		tests.for(cases)(name, split.vitest, (item, { __effectTestRun }) =>
			__effectTestRun((harness, context) => body(item, harness, context), split.clock ?? defaultClock),
		);
	};

	const effectApp: EffectTester<THarness, Provided> = Object.assign(register(tests), {
		each,
		fails: register(tests.fails),
		only: register(tests.only),
		runIf: (condition: unknown) => register(tests.runIf(condition)),
		skip: register(tests.skip),
		skipIf: (condition: unknown) => register(tests.skipIf(condition)),
	});

	return { effectApp };
}
