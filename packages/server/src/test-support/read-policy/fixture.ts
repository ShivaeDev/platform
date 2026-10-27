import { Context, Effect, Layer, Option, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { collection, type Key } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { query } from "@shivaedev/contract/operation.ts";
import type { IdentityValue } from "@shivaedev/identity/identity.ts";
import { Authenticated, AuthenticatedUser, MaybeAuthenticated } from "@shivaedev/identity/middleware.ts";
import { authenticatedUserLayer } from "@shivaedev/identity/server/session.ts";
import { AppChanges, appHost } from "#appHost.ts";
import type { HostState } from "#test/app-host/state.ts";

class ReadChecks extends Context.Service<ReadChecks, Check[]>()("test/ReadChecks") {}
class ReadStore extends Context.Service<ReadStore, Map<string, string>>()("test/ReadStore") {}
export const documents = collection("documents", Schema.String);
const Get = query("get", {
	payload: { owner: Schema.String },
	readPolicy: ({ owner }, viewer) =>
		Effect.gen(function* () {
			(yield* ReadChecks).push({ key: documents.item(owner), viewer });
			const rows = yield* ReadStore;
			return Option.isSome(viewer) && owner === viewer.value.id && rows.has(owner);
		}),
	reads: ({ owner }) => [documents.item(owner)],
	success: Schema.String,
});
const Account = contract("account", { queries: [Get] }).middleware(Authenticated);
const Profile = contract("profile", { queries: [Get] }).middleware(AuthenticatedUser);
const Public = contract("public", {
	queries: [
		query("read", {
			readPolicy: (_payload, viewer) =>
				Effect.map(ReadChecks, (checks) => {
					checks.push({ key: documents.list, viewer });
					return true;
				}),
			reads: () => [documents.list],
			success: Schema.String,
		}),
	],
}).middleware(MaybeAuthenticated);
const Plain = contract("plain", {
	queries: [
		query("get", {
			readPolicy: (_payload, viewer) =>
				Effect.map(ReadChecks, (checks) => {
					checks.push({ key: documents.item("private"), viewer });
					return false;
				}),
			reads: () => [documents.item("private")],
			success: Schema.String,
		}),
	],
});
export const Api = Account.merge(Profile, Public, Plain);
export interface Check {
	readonly key: Key;
	readonly viewer: Option.Option<IdentityValue>;
}
export function policyHost(state: HostState, checks: Check[]) {
	const sessions = {
		origin: () => true,
		provider: {
			get: (headers: Readonly<Record<string, string>>) => {
				const id = headers.authorization;
				state.lookups.push(id ?? "");
				return Effect.succeed(id === undefined ? Option.none() : Option.some({ user: { email: `${id}@example.test`, id, name: id } }));
			},
		},
	};
	function read({ owner }: { owner: string }) {
		return Effect.map(ReadStore, (rows) => rows.get(owner) ?? "Missing");
	}
	return appHost({
		config: { port: 0 },
		group: Api,
		handlers: Layer.mergeAll(
			Account.application.toLayer({ "account.get": read }),
			Profile.application.toLayer({ "profile.get": read }),
			Public.application.toLayer({ "public.read": () => Effect.succeed("Public documents") }),
			Plain.application.toLayer({
				"plain.get": () =>
					Effect.sync(() => {
						state.calls.push("plain.get");
						return "Private document";
					}),
			}),
			authenticatedUserLayer(sessions),
		),
		services: Layer.mergeAll(
			Layer.succeed(ReadChecks, checks),
			Layer.succeed(
				ReadStore,
				new Map([
					["alice", "Alice's document"],
					["bob", "Bob's document"],
				]),
			),
			Layer.effect(AppChanges, makeLiveServer).pipe(Layer.provideMerge(Reactivity.layer)),
		),
		sessions,
	});
}
