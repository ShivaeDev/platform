import { NodeCrypto } from "@effect/platform-node";
import type { TestContext } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as TestCrypto from "effect/testing/TestCrypto";
import { makeEffectIt } from "@shivaedev/test/makeEffectIt.ts";
import type { EffectTest, EffectTestOptions } from "@shivaedev/test/types.ts";
import { freshDocument, inDom } from "#internal/domDocument.ts";
import { type Genre, genreOf } from "#internal/genre.ts";
import { type AnyEffect, hooked } from "#internal/hooked.ts";
import type { LooseDefinition, LooseTrait } from "#internal/seed.ts";
import { start } from "#internal/start.ts";
import { routeOutbound } from "#routeOutbound.ts";

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
		return yield* start(definition, given, context, (told) => hooked(() => body?.(told, context)));
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
	const outbound = definition.outbound ?? (inDom() ? {} : undefined);
	const { effectApp } = makeEffectIt({
		around: (effect) =>
			Effect.gen(function* () {
				yield* freshDocument;
				if (outbound !== undefined) {
					yield* routeOutbound(outbound);
				}
				return yield* definition.around?.(effect) ?? effect;
			}).pipe(Effect.provide(TestCrypto.layer(0).pipe(Layer.provide(NodeCrypto.layer)))),
		clock: definition.clock,
		layer: definition.layer ?? Layer.empty,
		makeHarness: () => Effect.void,
	});
	function register(declare: EffectTest<unknown, unknown>) {
		return declaring(definition, genre, definition.runIf === false ? effectApp.skip : declare);
	}
	return Object.assign(register(effectApp), {
		fails: register(effectApp.fails),
		only: register(effectApp.only),
		runIf: (condition: unknown) => register(effectApp.runIf(condition)),
		skip: register(effectApp.skip),
		skipIf: (condition: unknown) => register(effectApp.skipIf(condition)),
	});
}
