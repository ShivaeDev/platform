import { layer, type Vitest } from "@effect/vitest";
import { Effect, type Layer, type Scope } from "effect";

type Body<R> = () => Generator<Effect.Effect<unknown, unknown, R>, unknown, never>;

type GeneratorTest<R> = <TEffect extends Effect.Effect<unknown, unknown, R>, A>(
	name: string,
	body: () => Generator<TEffect, A, never>,
	timeout?: number,
) => void;

interface GeneratorTester<R> extends GeneratorTest<R> {
	readonly skipIf: (condition: unknown) => GeneratorTest<R>;
}

function generatorTest<R>(register: Vitest.Test<R>): GeneratorTest<R> {
	return (name: string, body: Body<R>, timeout?: number) => register(name, () => Effect.gen(body), timeout);
}

function layered<TProvided, E>(provided: Layer.Layer<TProvided, E>) {
	return (name: string, tests: (it: { readonly effect: GeneratorTester<TProvided | Scope.Scope> }) => void) =>
		layer(provided)(name, (inner) =>
			tests({
				effect: Object.assign(generatorTest(inner.effect), { skipIf: (condition: unknown) => generatorTest(inner.effect.skipIf(condition)) }),
			}),
		);
}

export const it = { layer: layered };
