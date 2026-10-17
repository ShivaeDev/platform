import { Effect } from "effect";
import { Migrator } from "effect/sql";
import { expect } from "vitest";
import { migrationSteps } from "#migrationSteps.ts";
import { migrations } from "./migrationSteps.ts";

export const loaderResourcesAreScoped = Effect.fn("MigrationStory.loaderResourcesAreScoped")(function* () {
	let closed = false;
	yield* Effect.scoped(
		Effect.gen(function* () {
			const failure = new Migrator.MigrationError({ kind: "ImportError", message: "loader refused" });
			expect(yield* migrationSteps({ ...migrations, loader: Effect.fail(failure) }).pipe(Effect.flip)).toBe(failure);
			const loader = Effect.acquireRelease(migrations.loader, () =>
				Effect.sync(() => {
					closed = true;
				}),
			);
			const steps = yield* migrationSteps({ loader, lockTimeout: migrations.lockTimeout });
			expect(closed).toBe(false);
			yield* steps.migrateTo("1_create_contacts");
			expect(closed).toBe(false);
			yield* steps.migrateToLatest;
			expect(closed).toBe(false);
		}),
	);
	expect(closed).toBe(true);
});
