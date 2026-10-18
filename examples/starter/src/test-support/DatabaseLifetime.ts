import { Context } from "effect";

export interface DatabaseLifetimeReadout {
	connectionAtAppClose: readonly { readonly available: number }[];
	name: string;
	remainingDatabases: readonly { readonly datname: string }[] | undefined;
	scopeAtAppClose: string | undefined;
}

export const DatabaseLifetime = Context.Reference<DatabaseLifetimeReadout>("app/test/DatabaseLifetime", {
	defaultValue: () => ({ connectionAtAppClose: [], name: "", remainingDatabases: undefined, scopeAtAppClose: undefined }),
});
