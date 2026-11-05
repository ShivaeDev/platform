import { Duration, Effect, Fiber, Schedule } from "effect";
import { Migrator } from "effect/sql";
import { assertPostgresMigrations, postgresMigrationError } from "@shivaedev/sql/assertPostgresMigrations.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { type PendingPostgresMigrations, pendingPostgresMigrations } from "@shivaedev/sql/pendingPostgresMigrations.ts";
import type { MigrationOptions } from "#MigrationOptions.ts";

export function prepareMigrations<R, E>(migrations: MigrationOptions<R, E>) {
	switch (migrations.mode ?? "migrate") {
		case "check": {
			const { release: _release, ...schema } = migrations;
			return assertPostgresMigrations(schema);
		}
		case "wait":
			return waitForMigrations(migrations);
		case "migrate":
			return migratePostgres({ ...migrations, lockTimeout: migrations.lockTimeout ?? "5 seconds" }).pipe(Effect.asVoid);
	}
}

function waitForMigrations<R, E>(migrations: MigrationOptions<R, E>) {
	return Effect.gen(function* () {
		const progressInterval = Duration.fromInputUnsafe(migrations.progressInterval ?? "30 seconds");
		let pending: PendingPostgresMigrations = { components: [], migrations: [] };
		let progress: Fiber.Fiber<never> | undefined;
		function log(message: string) {
			return Effect.suspend(() =>
				Effect.logInfo(message).pipe(Effect.annotateLogs({ pendingComponents: pending.components, pendingMigrations: pending.migrations })),
			);
		}
		yield* Effect.gen(function* () {
			pending = yield* pendingPostgresMigrations(migrations);
			if (pending.migrations.length === 0 && pending.components.length === 0) {
				return;
			}
			if (progress === undefined) {
				yield* log("Waiting for database migrations");
				progress = yield* Effect.forever(Effect.sleep(progressInterval).pipe(Effect.andThen(log("Still waiting for database migrations")))).pipe(
					Effect.forkScoped,
				);
			}
			return yield* Effect.fail(postgresMigrationError(pending));
		}).pipe(
			Effect.retry({
				schedule: Schedule.max([Schedule.spaced(migrations.pollInterval ?? "1 second"), Schedule.during(migrations.waitTimeout ?? "5 minutes")]),
				while: (error) => error instanceof Migrator.MigrationError && error.kind === "BadState",
			}),
			Effect.tapError((error) =>
				error instanceof Migrator.MigrationError && error.kind === "BadState" ? log("Timed out waiting for database migrations") : Effect.void,
			),
		);
		if (progress !== undefined) {
			yield* Fiber.interrupt(progress);
			yield* Effect.logInfo("Database migrations current");
		}
	}).pipe(Effect.scoped);
}
