import { Context } from "effect";

export interface DatabaseLifetimeReadout {
	connectionAtAppClose: readonly { readonly available: number }[];
	connectionsAtAppClose: readonly { readonly pid: number; readonly state: string }[];
	name: string;
	scopeAtAppClose: string | undefined;
	teardownDuration: number | undefined;
}

export const DatabaseLifetime = Context.Reference<DatabaseLifetimeReadout>("app/test/DatabaseLifetime", {
	defaultValue: () => ({
		connectionAtAppClose: [],
		connectionsAtAppClose: [],
		name: "",
		scopeAtAppClose: undefined,
		teardownDuration: undefined,
	}),
});
