import { Effect } from "effect";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { Forbidden } from "@shivaedev/errors/taxonomy.ts";

export function resolveRole(roles: RoleSet, stored: unknown) {
	if (stored === undefined || stored === null) {
		return Effect.andThen(
			Effect.logWarning("Stored user role is missing. Run migrateBetterAuth with defaultRole, then use assignRole for administrators."),
			Effect.fail(new Forbidden({ message: "User role is missing" })),
		);
	}
	return roles.resolve(stored).pipe(
		Effect.mapError((cause) => new Error(`Stored user role is not declared by the application: ${String(stored)}`, { cause })),
		Effect.orDie,
	);
}
