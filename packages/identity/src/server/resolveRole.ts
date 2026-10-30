import { Effect } from "effect";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";

export function resolveRole(roles: RoleSet, stored: unknown) {
	return roles.resolve(stored).pipe(
		Effect.mapError((cause) => new Error(`Stored user role is not declared by the application: ${String(stored)}`, { cause })),
		Effect.orDie,
	);
}
