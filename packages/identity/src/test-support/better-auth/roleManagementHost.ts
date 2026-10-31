import { admin, testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpRouter } from "effect/http";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization, RpcServer } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { role as declareRole } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { AssignRoles } from "@shivaedev/access/roles.ts";
import { ReadUsers, UsersPermission } from "@shivaedev/admin/permissions.ts";
import { usersHandlers } from "@shivaedev/admin/server/usersHandlers.ts";
import { usersPage } from "@shivaedev/admin/users/page.ts";
import { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { assignRole } from "#server/better-auth/assignRole.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";
import { signedInUser } from "#server/better-auth/testing.ts";
import { permissionLayer } from "#server/permissions.ts";

const Access = roleSet(declareRole("user", []), declareRole("admin", [ReadUsers, AssignRoles]), declareRole("delegate", [ReadUsers, AssignRoles]));
const Page = usersPage(Access);
const ORIGIN = "http://localhost";
const Session = Schema.Struct({ user: Schema.Struct({ role: Schema.String }) });
export type ManagedRole = typeof Access.Role.Type;
export type Person = "alice" | "bob";
export type RoleActor = Person | "visitor";

export const roleManagementHost = Effect.fnUntraced(function* () {
	const pool = yield* betterAuthDatabase();
	const mounted = yield* betterAuthMount(
		{
			"baseURL": ORIGIN,
			database: pool,
			disabledPaths: ["/update-user"],
			logger: { disabled: true },
			plugins: [admin(), testUtils()],
			secret: "role-management-story-secret-at-least-32-characters",
			session: { cookieCache: { enabled: false } },
		},
		{ defaultRole: "user", roles: Access },
	).pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: {} }))));
	const context = yield* Effect.promise(() => mounted.auth.$context);
	yield* Effect.promise(() => context.runMigrations());
	// Minted sessions start the story after registration and sign-in.
	const alice = yield* Effect.promise(() => signedInUser(mounted.auth, { email: "alice@roles.test", name: "alice", role: "admin" }));
	const bob = yield* Effect.promise(() => signedInUser(mounted.auth, { email: "bob@roles.test", name: "bob", role: "user" }));
	const accounts = { alice, bob };
	const sql = yield* SqlClient.SqlClient;
	const live = yield* LiveServer.pipe(Effect.provide(LiveServer.layer));
	const handlers = Layer.merge(usersHandlers(Page, Access), hostChanges(Page.contract)).pipe(
		Layer.provide([Layer.succeed(LiveServer, live), Layer.succeed(SqlClient.SqlClient, sql), Reactivity.layer]),
	);
	const rpcRoutes = RpcServer.layerHttp({ group: Page.contract, path: "/rpc", protocol: "http" }).pipe(
		Layer.provide([handlers, permissionLayer(UsersPermission, { ...mounted.sessions, origin: () => true }), RpcSerialization.layerJson]),
	);
	const app = HttpRouter.toWebHandler(Layer.merge(mounted.routes, rpcRoutes), { disableLogger: true });
	yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
	function client() {
		const protocol = RpcClient.layerProtocolHttp({ url: `${ORIGIN}/rpc` }).pipe(
			Layer.provide([FetchHttpClient.layer, RpcSerialization.layerJson]),
			Layer.provide(
				Layer.succeed(FetchHttpClient.Fetch, (input, init) => {
					const request = new Request(input, init);
					request.headers.set("cookie", alice.headers.get("cookie") ?? "");
					return app.handler(request);
				}),
			),
		);
		return RpcClient.make(Page.contract).pipe(Effect.provide(protocol));
	}
	return {
		changeOnUsersPage: (person: Person, role: ManagedRole) =>
			Effect.flatMap(client(), (rpc) => rpc["admin.users.changeRole"]({ role, userId: accounts[person].user.id })),
		request: (actor: RoleActor, path: string, body: object) =>
			Effect.promise(() =>
				app.handler(
					new Request(`${ORIGIN}/api/auth${path}`, {
						body: JSON.stringify(body),
						headers: {
							"content-type": "application/json",
							cookie: actor === "visitor" ? "" : (accounts[actor].headers.get("cookie") ?? ""),
							origin: ORIGIN,
						},
						method: "POST",
					}),
				),
			),
		rolesOnUsersPage: () =>
			Effect.flatMap(client(), (rpc) => rpc["admin.users.list"]({ limit: 100 })).pipe(
				Effect.map(({ users }) => Object.fromEntries(users.map(({ name, role }) => [name, role]))),
			),
		seedRole: (person: Person, role: ManagedRole) =>
			assignRole(Access, accounts[person].user.id, role).pipe(
				Effect.map((changed) => (changed ? "assigned" : "unchanged")),
				Effect.catchTag("LastRoleAssigner", () => Effect.succeed("last role assigner")),
			),
		sessionRole: (person: Person) =>
			Effect.promise(async () => {
				const response = await app.handler(new Request(`${ORIGIN}/api/auth/get-session`, { headers: accounts[person].headers }));
				return Schema.decodeUnknownSync(Session)(await response.json()).user.role;
			}),
		userId: (person: Person) => accounts[person].user.id,
	};
});
