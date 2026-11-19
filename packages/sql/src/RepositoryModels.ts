import { Context, Effect, type Schema } from "effect";

// A host learns every model its repositories are built on while it builds them, before it serves a request.
export const RepositoryModels = Context.Reference<{ readonly declare: (model: Schema.Top) => Effect.Effect<void> }>(
	"@shivaedev/sql/RepositoryModels",
	{ defaultValue: () => ({ declare: () => Effect.void }) },
);
