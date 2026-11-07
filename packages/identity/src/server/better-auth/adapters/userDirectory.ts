import { Effect, Layer, Option, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import type { AccessPolicy } from "@shivaedev/access/roleSet.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { AuthTableOptions } from "#server/better-auth/adapters/tables.ts";
import { assignRole } from "#server/better-auth/assignRole.ts";
import { userDirectoryReads } from "#server/better-auth/userDirectoryReads.ts";
import { UserDirectory } from "#server/UserDirectory.ts";

export function betterAuthUserDirectory<TRole extends string>(
	access: Pick<AccessPolicy<TRole>, "Role" | "hasPermission">,
	options?: AuthTableOptions,
) {
	return Layer.effect(UserDirectory)(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const existing = yield* Effect.serviceOption(Reactivity.Reactivity);
			const reactivity = Option.isSome(existing) ? existing.value : yield* Reactivity.make;
			const reads = yield* userDirectoryReads(access, options);
			return {
				...reads,
				assignRole: (userId: string, role: string) =>
					Schema.decodeUnknownEffect(access.Role)(role).pipe(
						Effect.mapError(() => new AuthUnavailable({ message: "User role is not declared by the application" })),
						Effect.flatMap((declared) => assignRole(access, userId, declared, options)),
						Effect.provideService(SqlClient.SqlClient, sql),
						Effect.provideService(Reactivity.Reactivity, reactivity),
					),
			};
		}),
	);
}
