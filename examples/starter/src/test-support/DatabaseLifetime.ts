import { Context, Effect } from "effect";
import type { SqlError } from "effect/sql/SqlError";

export interface DatabaseLifetimeReadout {
	readonly awaitCleanup: Effect.Effect<readonly { readonly datname: string }[], SqlError>;
	connectionAtAppClose: readonly { readonly available: number }[];
	name: string;
	scopeAtAppClose: string | undefined;
}

export const DatabaseLifetime = Context.Reference<DatabaseLifetimeReadout>("app/test/DatabaseLifetime", {
	defaultValue: () => ({
		awaitCleanup: Effect.die("No story database has been acquired"),
		connectionAtAppClose: [],
		name: "",
		scopeAtAppClose: undefined,
	}),
});
