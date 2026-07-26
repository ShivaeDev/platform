import { it as effectIt } from "@effect/vitest";
import { Effect, Exit, Layer, Scope } from "effect";
import {
	type FixtureTestApi,
	fixtureName,
	makeDatabaseTester,
} from "../internal/vitest-database.js";
import type {
	AnyDatabase,
	DatabaseIt,
	DatabaseRequirement,
	MakeDatabaseItOptions,
} from "./types.js";

export const makeDatabaseIt = <
	Database extends AnyDatabase,
	Provided,
	LayerError,
>(
	options: MakeDatabaseItOptions<Database, Provided, LayerError> & {
		readonly layer: Layer.Layer<
			Provided | DatabaseRequirement<Database> | Effect.Services<Database>,
			LayerError
		>;
	},
): DatabaseIt<
	Database,
	Provided | DatabaseRequirement<Database> | Effect.Services<Database>
> => {
	type Services =
		| Provided
		| DatabaseRequirement<Database>
		| Effect.Services<Database>;

	const fixtureIt = effectIt.extend(
		fixtureName,
		{ scope: "worker" },
		// biome-ignore lint/correctness/noEmptyPattern: Vitest fixtures require a destructured context parameter.
		async ({}, { onCleanup }) => {
			const scope = Effect.runSync(Scope.make());
			onCleanup(() => Effect.runPromise(Scope.close(scope, Exit.void)));

			try {
				return await Effect.runPromise(
					Layer.buildWithScope(options.layer, scope),
				);
			} catch (error) {
				await Effect.runPromise(Scope.close(scope, Exit.void));
				throw error;
			}
		},
	);

	const effectDB = makeDatabaseTester(
		fixtureIt as unknown as FixtureTestApi<Services>,
		options.database,
	);

	return new Proxy(effectIt, {
		get(target, property, receiver) {
			if (property === "effectDB") {
				return effectDB;
			}
			return Reflect.get(target, property, receiver);
		},
	}) as unknown as DatabaseIt<Database, Services>;
};
