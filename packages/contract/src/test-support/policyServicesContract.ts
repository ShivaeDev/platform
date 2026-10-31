import { Context, Effect, Option, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { AuthUnavailable, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { SessionUserWithProviderAccounts } from "@shivaedev/identity/identity.ts";
import { AuthenticatedUserWithProviderAccounts } from "@shivaedev/identity/middleware.ts";
import { contract } from "#contract.ts";
import { query } from "#operation.ts";
import type { Viewer } from "#readPolicy.ts";

export class ReadAccess extends Context.Service<
	ReadAccess,
	{
		readonly allows: (
			account: string,
			viewer: Option.Option<Viewer>,
		) => Effect.Effect<boolean, AuthUnavailable | Unauthorized, SessionUserWithProviderAccounts>;
	}
>()("test/ProviderReadAccess") {}

export const documents = collection("provider-documents", Schema.String);
const definition = {
	payload: { account: Schema.String },
	readPolicy: (payload: { readonly account: string }, viewer: Option.Option<Viewer>) =>
		Effect.flatMap(ReadAccess, (access) => access.allows(payload.account, viewer)),
	reads: ({ account }: { readonly account: string }) => [documents.item(account)],
	rejections: { AuthUnavailable, Unauthorized },
	success: Schema.String,
};
const Get = query("get", definition);
const Compare = query("compare", { ...definition, live: "rerun-and-compare" });
export const Documents = contract("documents", { queries: [Get, Compare] }).middleware(AuthenticatedUserWithProviderAccounts);

export function readAccess(admitted: ReadonlySet<string>) {
	return ReadAccess.of({
		allows: Effect.fnUntraced(function* (account, viewer) {
			const user = yield* SessionUserWithProviderAccounts;
			const accounts = yield* user.providerAccounts;
			return (
				Option.isSome(viewer)
				&& viewer.value.id === user.id
				&& admitted.has(account)
				&& accounts.some((linked) => linked.providerId === "github" && linked.accountId === account)
			);
		}),
	});
}
