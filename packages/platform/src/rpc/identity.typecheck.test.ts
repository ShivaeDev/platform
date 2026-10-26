import { Effect, type Layer, Option, Schema } from "effect";
import { Headers } from "effect/http";
import { Rpc, RpcGroup, RpcTest } from "effect/rpc";
import { expectTypeOf } from "vitest";
import { AuthUnavailable, type Forbidden, Unauthorized } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { betterAuthSessions } from "#server/rpc-server/adapters/betterAuthSessions.ts";
import { permissionLayer } from "#server/rpc-server/permissions.ts";
import { authenticatedUserLayer, authenticatedUserWithProviderAccountsLayer } from "#server/rpc-server/session.ts";
import { ManagementPermission, TestRoles, ToolsPermission } from "#test/auth/permissions.ts";
import { Identity, type ProviderAccountValue, SessionUser, SessionUserWithProviderAccounts } from "./identity.ts";
import { Authenticated, AuthenticatedUser, AuthenticatedUserWithProviderAccounts } from "./middleware.ts";

const Profile = RpcGroup.make(Rpc.make("Whoami", { success: Schema.String })).middleware(AuthenticatedUser);
const handlers: Layer.Layer<never> = Profile.toLayer({
	Whoami: () => Effect.map(Effect.all([Identity, SessionUser]), ([identity, user]) => `${identity.id} ${user.name} ${user.email}`),
});
const IdOnly = RpcGroup.make(Rpc.make("Whoami", { success: Schema.String })).middleware(Authenticated);
// @ts-expect-error The id-only middleware does not provide a profile.
const missing: Layer.Layer<never> = IdOnly.toLayer({
	Whoami: () => Effect.map(SessionUser, (user) => user.email),
});
void missing;

const AdminTools = Rpc.make("AdminTools", { success: Schema.String });
const adminHandlers: Layer.Layer<never> = RpcGroup.make(AdminTools.middleware(ToolsPermission)).toLayer({
	AdminTools: () => Effect.map(SessionUser, (user) => user.email),
});
const ownerHandlers: Layer.Layer<never> = RpcGroup.make(AdminTools.middleware(ManagementPermission)).toLayer({
	AdminTools: () => Effect.map(SessionUser, (user) => user.email),
});
// @ts-expect-error Role checks run in middleware, so an RPC without it has no profile to read.
const unguardedAdmin: Layer.Layer<never> = RpcGroup.make(AdminTools).toLayer({
	AdminTools: () => Effect.map(SessionUser, (user) => user.email),
});
void [adminHandlers, ownerHandlers, unguardedAdmin];
const adminPolicy = {
	origin: () => true,
	provider: {
		get: () => Effect.succeed(Option.some({ user: { email: "a@example.test", id: "a", name: "A" } })),
	},
	roles: TestRoles,
};
Effect.gen(function* () {
	const client = yield* RpcTest.makeClient(RpcGroup.make(AdminTools.middleware(ToolsPermission)));
	const failure = yield* Effect.flip(client.AdminTools());
	expectTypeOf(failure).toEqualTypeOf<Unauthorized | AuthUnavailable | Forbidden>();
}).pipe(Effect.provide(adminHandlers), Effect.provide(permissionLayer(ToolsPermission, adminPolicy)), Effect.scoped);
permissionLayer(ManagementPermission, adminPolicy);

authenticatedUserLayer({
	origin: () => true,
	provider: {
		// @ts-expect-error Profile providers must supply name and email as well as id.
		get: () => Effect.succeed(Option.some({ user: { id: "alice" } })),
	},
});
Effect.gen(function* () {
	const client = yield* RpcTest.makeClient(Profile);
	const failure = yield* Effect.flip(client.Whoami());
	expectTypeOf(failure).toEqualTypeOf<Unauthorized | AuthUnavailable | Forbidden>();
}).pipe(Effect.provide(handlers), Effect.scoped);

function getSession() {
	return Promise.resolve({
		user: { email: "typed@example.test", id: "typed", name: "Typed" },
	});
}
const plain = betterAuthSessions(getSession);
const accounts = betterAuthSessions(getSession, () => Promise.resolve([{ accountId: "123", providerId: "github" }]));
const plainPolicy = { origin: () => true, provider: plain };
authenticatedUserWithProviderAccountsLayer({
	...plainPolicy,
	provider: accounts,
});
// @ts-expect-error An accounts-capable boundary requires a provider with an accounts Effect.
authenticatedUserWithProviderAccountsLayer(plainPolicy);

Effect.gen(function* () {
	const plainSession = yield* plain.get(Headers.empty);
	if (Option.isSome(plainSession)) {
		// @ts-expect-error Without a lookup the session user has no provider accounts.
		void plainSession.value.user.providerAccounts;
	}
	const accountSession = yield* accounts.get(Headers.empty);
	if (Option.isSome(accountSession)) {
		expectTypeOf(accountSession.value.user.providerAccounts).toEqualTypeOf<
			Effect.Effect<readonly ProviderAccountValue[], AuthUnavailable | Unauthorized>
		>();
	}
	const user = yield* SessionUser;
	// @ts-expect-error The base session profile has no provider accounts.
	void user.providerAccounts;
});

const Api = RpcGroup.make(
	Rpc.make("Accounts", {
		error: Schema.Union([AuthUnavailable, Unauthorized]),
		success: Schema.Array(Schema.Struct({ accountId: Schema.String, providerId: Schema.String })),
	}),
);
const readAccounts = Effect.fnUntraced(function* () {
	const user = yield* SessionUserWithProviderAccounts;
	return yield* user.providerAccounts;
});
const provided: Layer.Layer<never> = Api.middleware(AuthenticatedUserWithProviderAccounts).toLayer({ Accounts: readAccounts });
// @ts-expect-error Base profile middleware cannot supply the accounts-capable user service.
const missingAccounts: Layer.Layer<never> = Api.middleware(AuthenticatedUser).toLayer({ Accounts: readAccounts });
void [provided, missingAccounts];
