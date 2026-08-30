import { it as effectIt } from "@effect/vitest";
import { makeEffectIt } from "@shivaedev/effect-test";
import type { Effect, Layer } from "effect";
import { withTestTransaction } from "./transaction.js";
import type {
	AnyDatabase,
	DatabaseIt,
	DatabaseService,
	MakeDatabaseItOptions,
} from "./types.js";

export const makeDatabaseIt = <
	Database extends AnyDatabase,
	Provided,
	LayerError,
>(
	options: MakeDatabaseItOptions<Database, Provided, LayerError> & {
		readonly layer: Layer.Layer<
			Provided | Effect.Services<Database>,
			LayerError
		>;
	},
): DatabaseIt<Database, Provided | Effect.Services<Database>> => {
	type Services = Provided | Effect.Services<Database>;

	const { effectApp } = makeEffectIt({
		around: (effect) => withTestTransaction(options.database, effect),
		clock: options.clock,
		layer: options.layer,
		makeHarness: () =>
			options.database as unknown as Effect.Effect<
				DatabaseService<Database>,
				never,
				Effect.Services<Database>
			>,
	});

	return new Proxy(effectIt, {
		get(target, property, receiver) {
			if (property === "effectDB") {
				return effectApp;
			}
			return Reflect.get(target, property, receiver);
		},
	}) as unknown as DatabaseIt<Database, Services>;
};
