import { Effect } from "effect";
import { Migrator } from "effect/sql";
import type { PostgresMigrationOptions } from "./migrations.ts";
import { type PendingPostgresMigrations, pendingPostgresMigrations } from "./pendingPostgresMigrations.ts";

export const assertPostgresMigrations = Effect.fn("EffectSql.assertPostgresMigrations")(function* <R>(
	options: Pick<PostgresMigrationOptions<R>, "loader" | "table" | "components" | "release">,
) {
	const pending = yield* pendingPostgresMigrations(options);
	if (pending.migrations.length > 0 || pending.components.length > 0) {
		return yield* Effect.fail(postgresMigrationError(pending));
	}
});

export function postgresMigrationError(pending: PendingPostgresMigrations) {
	const details = [
		...pending.migrations.map(({ id, name }) => `migration ${id} (${name})`),
		...pending.components.map(({ name, detail }) => `component ${name}: ${detail}`),
	];
	return new Migrator.MigrationError({
		kind: "BadState",
		message: `Database migrations are not current: ${details.join("; ")}. Run the deployment migration command.`,
	});
}
