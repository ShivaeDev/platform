import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { Context, Effect, Layer, type Scope } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlClient } from "effect/sql";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { readKeys } from "@shivaedev/changes/keys.ts";
import { AssignRoles } from "#roles.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import type { AuthTableOptions } from "#server/better-auth/adapters/tables.ts";
import { migrateBetterAuth } from "#server/better-auth/migrate.ts";
import { storedRoleOptions } from "#server/better-auth/storedRoleOptions.ts";
import { betterAuthUserDirectory } from "#server/better-auth/userDirectory.ts";
import { UserDirectory } from "#server/UserDirectory.ts";
import { roleKeys, userKeys } from "#users.ts";

const Access = roleSet(role("member", []), role("assigner", [AssignRoles]), role("delegate", [AssignRoles]));

export const directoryHost = Effect.fnUntraced(function* (mapping: AuthTableOptions, standalone: boolean) {
	const options = storedRoleOptions(
		{
			...mapping,
			"baseURL": "http://localhost:3000",
			database: yield* betterAuthDatabase(),
			logger: { disabled: true },
			plugins: [...(mapping.plugins ?? []), testUtils()],
			secret: "user-directory-story-secret-at-least-32-characters",
		},
		{ defaultRole: "member" },
	);
	yield* migrateBetterAuth(options, { defaultRole: "member" });
	const auth = betterAuth(options);
	const { test } = yield* Effect.promise(() => auth.$context);
	const reactivity = yield* Reactivity.Reactivity;
	const build = Layer.build(betterAuthUserDirectory(Access, options));
	const context = yield* standalone
		? build.pipe(
				Effect.updateContext((services: Context.Context<SqlClient.SqlClient | Scope.Scope>) => Context.omit(Reactivity.Reactivity)(services)),
			)
		: build;
	const directory = Context.get(context, UserDirectory);
	return {
		directory,
		mint: (id: string, name: string, storedRole: string) =>
			Effect.promise(() =>
				test.saveUser(test.createUser({ createdAt: new Date("2026-01-02T03:04:05Z"), email: `${id}@directory.test`, id, name, role: storedRole })),
			),
		watchRole: (id: string) => reactivity.query(readKeys([roleKeys.item(id)]), directory.role(id)),
		watchUsers: () => reactivity.query(readKeys([userKeys.list]), directory.list({ limit: 100 })),
	};
});
