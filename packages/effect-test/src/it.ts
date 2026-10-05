import { it as effectIt, type TestContext, type TestOptions, type Vitest } from "@effect/vitest";
import { Effect } from "effect";
import type { TestAPI } from "vitest";
import type { EffectIt, EffectItTest, EffectItTester } from "./types.ts";

type Body<TArgs extends readonly unknown[], R> = (
	...args: TArgs
) => Effect.Effect<unknown, unknown, R> | Generator<Effect.Effect<unknown, unknown, R>, unknown, never>;

function effectOf<TArgs extends readonly unknown[], R>(body: Body<TArgs, R>) {
	return (...args: TArgs): Effect.Effect<unknown, unknown, R> => {
		const result = body(...args);
		return Effect.isEffect(result) ? result : Effect.gen(() => result);
	};
}

function bodyTest<R>(register: Vitest.Test<R>): EffectItTest<R> {
	return (name: string, body: Body<[context: TestContext], R>, options?: number | TestOptions) => register(name, effectOf(body), options);
}

function bodyTester<R>(register: Vitest.Tester<R>): EffectItTester<R> {
	return Object.assign(bodyTest(register), {
		each:
			<TItem>(cases: readonly TItem[]): EffectItTest<R, [item: TItem]> =>
			(name: string, body: Body<[item: TItem], R>, options?: number | TestOptions) =>
				register.each(cases)(name, effectOf(body), options),
		fails: bodyTest(register.fails),
		only: bodyTest(register.only),
		runIf: (condition: unknown) => bodyTest(register.runIf(condition)),
		skip: bodyTest(register.skip),
		skipIf: (condition: unknown) => bodyTest(register.skipIf(condition)),
	});
}

const testers: Record<PropertyKey, unknown> = {};

const vitestTests = new Proxy<TestAPI>(effectIt, {
	get: (target, key, receiver) => (Object.hasOwn(testers, key) ? testers[key] : Reflect.get(target, key, receiver)),
	set: (_target, key, value) => Reflect.set(testers, key, value),
});

export const it: EffectIt = Object.assign(vitestTests, {
	effect: bodyTester(effectIt.effect),
	live: bodyTester(effectIt.live),
});
