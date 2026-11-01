import { it as effectIt, type TestContext, type TestOptions } from "@effect/vitest";
import { Effect, type Scope } from "effect";
import type { TestAPI } from "vitest";
import { runEffectTest } from "#internal/runEffectTest.ts";
import type { EffectClock, EffectIt, EffectItTest, EffectItTester } from "./types.ts";

type Body<TArgs extends readonly unknown[], R> = (
	...args: TArgs
) => Effect.Effect<unknown, unknown, R> | Generator<Effect.Effect<unknown, unknown, R>, unknown, never>;

function effectOf<TArgs extends readonly unknown[], R>(body: Body<TArgs, R>) {
	return (...args: TArgs): Effect.Effect<unknown, unknown, R> =>
		Effect.suspend(() => {
			const result = body(...args);
			return Effect.isEffect(result) ? result : Effect.gen(() => result);
		});
}

function testOptions(options?: number | TestOptions): TestOptions {
	return typeof options === "number" ? { timeout: options } : (options ?? {});
}

function bodyTest(register: TestAPI["fails"], clock: EffectClock): EffectItTest<Scope.Scope> {
	return (name: string, body: Body<[context: TestContext], Scope.Scope>, options?: number | TestOptions) =>
		register(name, testOptions(options), (context) => runEffectTest(effectOf(body)(context), context, clock));
}

function bodyTester(register: TestAPI, clock: EffectClock): EffectItTester<Scope.Scope> {
	return Object.assign(bodyTest(register, clock), {
		each:
			<TItem>(cases: readonly TItem[]): EffectItTest<Scope.Scope, [item: TItem]> =>
			(name: string, body: Body<[item: TItem], Scope.Scope>, options?: number | TestOptions) =>
				register.for(cases)(name, testOptions(options), (item, context) => runEffectTest(Effect.asVoid(effectOf(body)(item)), context, clock)),
		fails: bodyTest(register.fails, clock),
		only: bodyTest(register.only, clock),
		runIf: (condition: unknown) => bodyTest(register.runIf(condition), clock),
		skip: bodyTest(register.skip, clock),
		skipIf: (condition: unknown) => bodyTest(register.skipIf(condition), clock),
	});
}

const testers: Record<PropertyKey, unknown> = {};

const vitestTests = new Proxy<TestAPI>(effectIt, {
	get: (target, key, receiver) => (Object.hasOwn(testers, key) ? testers[key] : Reflect.get(target, key, receiver)),
	set: (_target, key, value) => Reflect.set(testers, key, value),
});

export const it: EffectIt = Object.assign(vitestTests, {
	effect: bodyTester(effectIt, "test"),
	live: bodyTester(effectIt, "live"),
});
