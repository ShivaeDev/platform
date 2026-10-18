import type { Duration } from "effect";
import type { Migrator } from "effect/sql";

export interface MigrationOptions<R> {
	readonly loader: Migrator.Loader<R>;
	readonly lockTimeout?: Duration.Input;
	readonly mode?: "migrate" | "check" | "wait";
	readonly pollInterval?: Duration.Input;
	readonly table?: string;
	readonly waitTimeout?: Duration.Input;
}
