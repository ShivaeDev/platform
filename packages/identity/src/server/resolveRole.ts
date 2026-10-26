import { Effect } from "effect";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";

export function resolveRole(roles: RoleSet, stored: unknown) {
	return roles.resolve(stored).pipe(Effect.mapError(() => new AuthUnavailable({ message: "Stored user role is not declared by the application" })));
}
