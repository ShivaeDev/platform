import { it as effectIt } from "@effect/vitest";
import type { Effect, Layer } from "effect";
import type { EffectClock } from "@shivaedev/effect-test/types.ts";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import type { AnyDatabase } from "#databaseTypes.ts";
import { withTestTransaction } from "./transaction.ts";
import type { DatabaseIt, MakeDatabaseItOptions } from "./types.ts";

export function makeDatabaseIt<Database extends AnyDatabase, Provided, LayerError>(
	options: MakeDatabaseItOptions<Database, Provided, LayerError> & {
		readonly layer: Layer.Layer<Provided | Effect.Services<Database>, LayerError>;
	},
): DatabaseIt<Database, Provided | Effect.Services<Database>>;
export function makeDatabaseIt(options: {
	readonly clock?: EffectClock | undefined;
	readonly database: AnyDatabase;
	readonly layer: Layer.Layer<unknown, unknown>;
}): unknown {
	const { effectApp } = makeEffectIt({
		around: (effect) => withTestTransaction(options.database, effect),
		clock: options.clock,
		layer: options.layer,
		makeHarness: () => options.database,
	});

	return new Proxy(effectIt, {
		get(target, property, receiver) {
			if (property === "effectDB") {
				return effectApp;
			}
			return Reflect.get(target, property, receiver);
		},
	});
}
