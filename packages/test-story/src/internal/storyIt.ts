import type { TestContext } from "@effect/vitest";
import { Context, Effect, Layer } from "effect";
import type { AnyTestLayer } from "@shivaedev/effect-test/any-test-layer.ts";
import type { EffectTest, EffectTestOptions } from "@shivaedev/effect-test/types.ts";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { genreTag } from "#genreTag.ts";
import { undeclaredGenre } from "#internal/errors.ts";
import { type AnyEffect, hooked } from "#internal/hooked.ts";
import type { LooseDefinition, LooseTrait } from "#internal/seed.ts";
import { start } from "#internal/start.ts";

type LooseBody = (told: object, context: TestContext) => Generator<AnyEffect, unknown, never> | undefined;

type LooseTest = (name: string, given: readonly LooseTrait[], body?: LooseBody, options?: number | EffectTestOptions) => void;

export interface LooseIt extends LooseTest {
	readonly fails: LooseTest;
	readonly only: LooseTest;
	readonly runIf: (condition: unknown) => LooseTest;
	readonly skip: LooseTest;
	readonly skipIf: (condition: unknown) => LooseTest;
}

// makeEffectIt takes only a layer that provides a service, so a kit without a layer provides its genre.
class Genre extends Context.Service<Genre, string>()("@shivaedev/test-story/Genre") {}

function tagged(options: number | EffectTestOptions | undefined, tag: string): EffectTestOptions {
	if (typeof options === "number") {
		return { tags: [tag], timeout: options };
	}
	const own = options?.tags ?? [];
	return { ...options, tags: [tag, ...(typeof own === "string" ? [own] : own)] };
}

function storyOf(definition: LooseDefinition, given: readonly LooseTrait[], body: LooseBody | undefined) {
	return function* story(_harness: object, context: TestContext) {
		const told = yield* start(definition, given, context);
		return yield* hooked(() => body?.(told, context));
	};
}

function declaring(definition: LooseDefinition, tag: string, declare: EffectTest<object, unknown>): LooseTest {
	return (name, given, body, options) => {
		try {
			declare(name, storyOf(definition, given, body), tagged(options, tag));
		} catch (error) {
			throw error instanceof Error && error.message.includes(`"${tag}"`) ? undeclaredGenre(definition.name, tag, error) : error;
		}
	};
}

export function storyIt(definition: LooseDefinition): LooseIt {
	const tag = genreTag(definition.name).name;
	const layer: AnyTestLayer = definition.layer ?? Layer.succeed(Genre, tag);
	const { effectApp } = makeEffectIt({ layer, makeHarness: () => Effect.succeed({}) });
	return Object.assign(declaring(definition, tag, effectApp), {
		fails: declaring(definition, tag, effectApp.fails),
		only: declaring(definition, tag, effectApp.only),
		runIf: (condition: unknown) => declaring(definition, tag, effectApp.runIf(condition)),
		skip: declaring(definition, tag, effectApp.skip),
		skipIf: (condition: unknown) => declaring(definition, tag, effectApp.skipIf(condition)),
	});
}
