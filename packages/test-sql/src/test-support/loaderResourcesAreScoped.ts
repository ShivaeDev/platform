import { Effect } from "effect";
import { Migrator } from "effect/sql";
import { migrationSteps } from "#migrationSteps.ts";
import { migrations } from "./migrationSteps.ts";

export const loaderResourcesAreScoped = Effect.fn("MigrationStory.loaderResourcesAreScoped")(function* () {
	let closed = false;
	const observed: boolean[] = [];
	const failure = new Migrator.MigrationError({ kind: "ImportError", message: "loader refused" });
	let received: unknown;
	yield* Effect.scoped(
		Effect.gen(function* () {
			received = yield* migrationSteps({ ...migrations, loader: Effect.fail(failure) }).pipe(Effect.flip);
			const loader = Effect.acquireRelease(migrations.loader, () =>
				Effect.sync(() => {
					closed = true;
				}),
			);
			const steps = yield* migrationSteps({ loader, lockTimeout: migrations.lockTimeout });
			observed.push(closed);
			yield* steps.migrateTo("1_create_contacts");
			observed.push(closed);
			yield* steps.migrateToLatest;
			observed.push(closed);
		}),
	);
	return { after: closed, during: observed, failure, received };
});
