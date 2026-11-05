import { Clock, Context, Effect, Layer, Schema, Stream } from "effect";
import { Digest } from "effect/crypto";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcTest } from "effect/rpc";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { querySubscription } from "@shivaedev/contract/querySubscription.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";

const notes = collection("denied-live-notes", Schema.String);
class Access extends Context.Service<Access, { allowed: boolean; checks: string[] }>()("@shivaedev/react/test/DeniedLiveAccess") {}
const Notes = contract("deniedLive", {
	queries: [
		query("get", {
			payload: { id: Schema.String },
			readPolicy: ({ id }) =>
				Effect.map(Access, (access) => {
					access.checks.push(id);
					return access.allowed || id.startsWith("public");
				}),
			reads: ({ id }) => [notes.item(id)],
			success: Schema.String,
		}),
	],
});

export const deniedLiveClient = Effect.gen(function* () {
	const access: { allowed: boolean; checks: string[] } = { allowed: true, checks: [] };
	const requests: string[] = [];
	const response = { refused: false };
	const clock = yield* Clock.Clock;
	const digest = yield* Digest.Digest;
	const reactivity = yield* Reactivity.make;
	const live = yield* makeLiveServer.pipe(Effect.provideService(Reactivity.Reactivity, reactivity));
	const handlers = Notes.toLayer({
		"deniedLive.$changes": ({ queries }, { rpc }) =>
			Stream.unwrap(
				Effect.gen(function* () {
					requests.push(`subscribe ${queries.map(({ payload }) => payload.id).join(",")}`);
					const subscription = yield* querySubscription(rpc, queries, yield* CurrentViewer);
					return live.subscribe(subscription);
				}),
			),
		"deniedLive.get": ({ id }) =>
			Effect.gen(function* () {
				requests.push(`read ${id}`);
				if (response.refused) {
					return yield* new QueryReadDenied({ message: "Read refused" });
				}
				return id;
			}),
	});
	const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() });
	runtime.addGlobalLayer(Layer.mergeAll(Layer.succeed(Clock.Clock, clock), Layer.succeed(Digest.Digest, digest)));
	class Client extends AtomRpc.Service<Client>()("test/DeniedLiveClient", {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: handlers.pipe(Layer.provide(Layer.succeed(Access, access))),
		runtime,
	}) {}
	const api = bind(Notes, Client);
	return {
		access,
		announce: () => reactivity.invalidate(invalidationKeys([notes.item("private"), notes.item("private-details"), notes.item("private-counts")])),
		api,
		clientReactivity: Client.runtime.atom(Effect.service(Reactivity.Reactivity)),
		keys: invalidationKeys([notes.item("private"), notes.item("private-details"), notes.item("private-counts")]),
		requests,
		response,
		status: api[LiveConnection].status,
	};
});
