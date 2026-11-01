import { Context } from "effect";

export const MigrationStartedAt = Context.Reference<string | undefined>("@shivaedev/sql/internal/MigrationStartedAt", {
	defaultValue: () => undefined,
});
