import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import type { TestContext } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as TestCrypto from "effect/testing/TestCrypto";
import { makeEffectIt } from "@shivaedev/test/adapters/makeEffectIt.ts";
import type { EffectTest } from "@shivaedev/test/types.ts";
import { declareGenre } from "#server/adapters/declareGenre.ts";
import { freshDocument, inDom } from "#server/internal/domDocument.ts";
import { type Genre, genreOf } from "#server/internal/genre.ts";
import { type AnyEffect, hooked } from "#server/internal/hooked.ts";
import type { LooseDefinition, LooseTrait } from "#server/internal/seed.ts";
import { start } from "#server/internal/start.ts";
import { withWatchedClock } from "#server/internal/withWatchedClock.ts";
import { routeOutbound } from "#server/routeOutbound.ts";
import type { StoryTestOptions } from "#server/storyOptions.ts";

type LooseBody = (told: object, context: TestContext) => Generator<AnyEffect, unknown, never> | undefined;

type LooseTest = (name: string, given: readonly LooseTrait[], body?: LooseBody, options?: number | StoryTestOptions) => void;

export interface LooseIt extends LooseTest {
	readonly fails: LooseTest;
	readonly only: LooseTest;
	readonly runIf: (condition: unknown) => LooseTest;
	readonly skip: LooseTest;
	readonly skipIf: (condition: unknown) => LooseTest;
}

function storyOf(definition: LooseDefinition, given: readonly LooseTrait[], body: LooseBody | undefined) {
	return function* story(_harness: unknown, context: TestContext) {
		return yield* start(definition, given, context, (told) => hooked(() => body?.(told, context)));
	};
}

function declaring(definition: LooseDefinition, genre: Genre, declare: EffectTest<unknown, unknown>): LooseTest {
	return (name, given, body, options) => declareGenre(declare, `${genre.title}: ${name}`, storyOf(definition, given, body), options, genre.tag.name);
}

export function storyIt(definition: LooseDefinition): LooseIt {
	const genre = genreOf(definition.name);
	const outbound = definition.outbound ?? (inDom() ? {} : undefined);
	const { effectApp } = makeEffectIt({
		around: (effect) =>
			Effect.gen(function* () {
				yield* freshDocument;
				if (outbound !== undefined) {
					yield* routeOutbound(outbound, { passthrough: definition.outboundPassthrough === true });
				}
				return yield* definition.around?.(effect) ?? effect;
			}).pipe(Effect.provide(TestCrypto.layer(0).pipe(Layer.provide(NodeCrypto.layer))), withWatchedClock),
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
