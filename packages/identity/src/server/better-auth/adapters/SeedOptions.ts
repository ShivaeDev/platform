import type { BetterAuthOptions } from "better-auth";
import type { Effect } from "effect";
import type { AccessPolicy } from "@shivaedev/access/roleSet.ts";
import type { PasswordUser } from "#server/UserProvisioning.ts";

export interface SeedOptions<TRole extends string, E, R> {
	readonly auth?: Omit<BetterAuthOptions, "database">;
	readonly defaultRole: NoInfer<TRole>;
	readonly roles: AccessPolicy<TRole>;
	readonly run: Effect.Effect<unknown, E, R>;
	readonly users: readonly (PasswordUser & { readonly role: NoInfer<TRole> })[];
}
