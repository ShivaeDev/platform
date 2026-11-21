import { Effect, Layer, Option, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { SqlClient } from "effect/sql";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { assignRole } from "#server/better-auth/assignRole.ts";
import type { RoleTables } from "#server/better-auth/define.ts";
import { userDirectoryReads } from "#server/better-auth/userDirectoryReads.ts";
import { UserDirectory } from "#server/UserDirectory.ts";

export function betterAuthUserDirectory<TRole extends string>(auth: RoleTables<TRole>) {
	return Layer.effect(UserDirectory)(
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			const existing = yield* Effect.serviceOption(Reactivity.Reactivity);
			const reactivity = Option.isSome(existing) ? existing.value : yield* Reactivity.make;
			const reads = yield* userDirectoryReads(auth.roles, auth.options);
			return {
				...reads,
				assignRole: (userId: string, role: string) =>
					Schema.decodeUnknownEffect(auth.roles.Role)(role).pipe(
						Effect.mapError(() => new AuthUnavailable({ message: "User role is not declared by the application" })),
						Effect.flatMap((declared) => assignRole(auth, userId, declared)),
						Effect.provideService(SqlClient.SqlClient, sql),
						Effect.provideService(Reactivity.Reactivity, reactivity),
					),
			};
		}),
	);
}
