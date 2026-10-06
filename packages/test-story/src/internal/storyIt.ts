import type { TestContext } from "@effect/vitest";
import { Effect, Layer } from "effect";
import type { EffectTest, EffectTestOptions } from "@shivaedev/effect-test/types.ts";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { type Genre, genreOf } from "#internal/genre.ts";
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

function withTags(options: number | EffectTestOptions | undefined, tags: readonly string[]): EffectTestOptions {
	if (typeof options === "number") {
		return { tags: [...tags], timeout: options };
	}
	const own = options?.tags ?? [];
	return { ...options, tags: [...tags, ...(typeof own === "string" ? [own] : own)] };
}

function storyOf(definition: LooseDefinition, given: readonly LooseTrait[], body: LooseBody | undefined) {
	return function* story(_harness: unknown, context: TestContext) {
		const told = yield* start(definition, given, context);
		return yield* hooked(() => body?.(told, context));
	};
}

// Vitest refuses a tag its config does not declare, so a genre the config leaves out names the test without tagging it.
function declaring(definition: LooseDefinition, genre: Genre, declare: EffectTest<unknown, unknown>): LooseTest {
	return (name, given, body, options) => {
		const title = `${genre.title}: ${name}`;
		const story = storyOf(definition, given, body);
		try {
			declare(title, story, withTags(options, [genre.tag.name]));
		} catch (error) {
			if (!(error instanceof Error && error.message.includes(`"${genre.tag.name}"`))) {
				throw error;
			}
			declare(title, story, withTags(options, []));
		}
	};
}

export function storyIt(definition: LooseDefinition): LooseIt {
	const genre = genreOf(definition.name);
	const { effectApp } = makeEffectIt({ layer: definition.layer ?? Layer.empty, makeHarness: () => Effect.void });
	return Object.assign(declaring(definition, genre, effectApp), {
		fails: declaring(definition, genre, effectApp.fails),
		only: declaring(definition, genre, effectApp.only),
		runIf: (condition: unknown) => declaring(definition, genre, effectApp.runIf(condition)),
		skip: declaring(definition, genre, effectApp.skip),
		skipIf: (condition: unknown) => declaring(definition, genre, effectApp.skipIf(condition)),
	});
}
