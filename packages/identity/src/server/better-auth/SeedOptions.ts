import type { Effect } from "effect";
import type { PasswordUser } from "#server/UserProvisioning.ts";

export interface SeedOptions<TRole extends string, E, R> {
	readonly run: Effect.Effect<unknown, E, R>;
	readonly users: readonly (PasswordUser & { readonly role: NoInfer<TRole> })[];
}
