import { Effect, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { SqlClient } from "effect/sql";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { AuthUnavailable, Conflict, Forbidden, Unauthorized } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { collection, invalidationKeys } from "@shivaedev/effect-contract/keys.ts";
import { command, query } from "@shivaedev/effect-contract/operation.ts";
import { invalidateOnCommit, transact } from "@shivaedev/effect-sql/transact.ts";
import { Identity } from "#rpc/identity.ts";
import { Authenticated, AuthenticatedAdmin, AuthenticatedOwner, AuthenticatedUser, AuthenticatedUserWithProviderAccounts } from "#rpc/middleware.ts";

export const Preferences = collection("preferences", Schema.String);
const get = query("get", { payload: { id: Schema.String }, reads: ({ id }) => [Preferences.item(id)], success: Schema.String });
const list = query("list", { payload: {}, reads: () => [Preferences.list], success: Schema.String });
const save = command("save", {
	invalidates: ({ id }) => [Preferences.item(id), Preferences.list, Preferences.item(id)],
	payload: { announce: Schema.Boolean, id: Schema.String, reject: Schema.Boolean, value: Schema.String },
	rejections: { Conflict },
	success: Schema.String,
});
function scoped<const TName extends string>(name: TName) {
	return contract(name, { commands: [save], keyScope: "session", queries: [get, list] });
}
export class CustomAuthenticated extends RpcMiddleware.Service<CustomAuthenticated, { provides: Identity }>()("test/SessionKeysAuth", {
	error: Schema.Union([Unauthorized, AuthUnavailable, Forbidden]),
}) {}
export const Apis = {
	account: scoped("account").middleware(Authenticated),
	admin: scoped("admin").middleware(AuthenticatedAdmin),
	custom: scoped("custom").middleware(CustomAuthenticated),
	owner: scoped("owner").middleware(AuthenticatedOwner),
	profile: scoped("profile").middleware(AuthenticatedUser),
	providers: scoped("providers").middleware(AuthenticatedUserWithProviderAccounts),
};
export type Boundary = keyof typeof Apis;
const Unprotected = contract("unprotected", { keyScope: "session", queries: [list] });
export const Api = Unprotected.merge(Apis.account, Apis.admin, Apis.owner, Apis.profile, Apis.providers, Apis.custom);

const read = Effect.fnUntraced(function* ({ id }: { id: string }) {
	const { id: owner } = yield* Identity;
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql<{ value: string }>`select value from preferences where owner = ${owner} and id = ${id}`.pipe(Effect.orDie);
	return rows[0]?.value ?? "unset";
});
const write = Effect.fnUntraced(function* ({ id, value, announce, reject }: typeof save.payload.Type) {
	const identity = yield* Identity;
	const sql = yield* SqlClient.SqlClient;
	return yield* Effect.gen(function* () {
		yield* sql`insert into preferences (owner, id, value) values (${identity.id}, ${id}, ${value})
			on conflict (owner, id) do update set value = excluded.value`;
		if (announce) {
			yield* invalidateOnCommit(invalidationKeys([Preferences.item(id)], { scope: identity.id }));
		}
		if (reject) {
			return yield* new Conflict({ message: "Write rejected" });
		}
		return value;
	}).pipe(transact({ onSqlError: (error) => error }), Effect.catchTag("SqlError", Effect.die));
});
function listOwn() {
	return read({ id: "theme" });
}
export const handlers = Apis.account.application
	.merge(Apis.admin.application, Apis.custom.application, Apis.owner.application, Apis.profile.application, Apis.providers.application)
	.merge(Unprotected.application)
	.toLayer({
		"account.get": read,
		"account.list": listOwn,
		"account.save": write,
		"admin.get": read,
		"admin.list": listOwn,
		"admin.save": write,
		"custom.get": read,
		"custom.list": listOwn,
		"custom.save": write,
		"owner.get": read,
		"owner.list": listOwn,
		"owner.save": write,
		"profile.get": read,
		"profile.list": listOwn,
		"profile.save": write,
		"providers.get": read,
		"providers.list": listOwn,
		"providers.save": write,
		"unprotected.list": () => Effect.succeed("unset"),
	});
