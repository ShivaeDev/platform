import { Clock, Context, Effect, Layer, Schema, Stream } from "effect";
import { Digest } from "effect/crypto";
import * as Atom from "effect/reactivity/Atom";
import * as Reactivity from "effect/reactivity/Reactivity";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { changesHandlerLayer } from "@shivaedev/contract/changesHandlerLayer.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { querySubscription } from "@shivaedev/contract/querySubscription.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import { rerunQuery } from "@shivaedev/server/rerunQuery.ts";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";

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
	const application = Notes.application.toLayer({
		"deniedLive.get": ({ id }) =>
			Effect.gen(function* () {
				requests.push(`read ${id}`);
				if (response.refused) {
					return yield* new QueryReadDenied({ message: "Read refused" });
				}
				return id;
			}),
	});
	const handlers = Layer.merge(
		application,
		changesHandlerLayer(
			Notes,
			() =>
				({ queries }, options) =>
					Stream.unwrap(
						Effect.gen(function* () {
							requests.push(`subscribe ${queries.map(({ payload }) => payload.id).join(",")}`);
							const subscription = yield* querySubscription(options.rpc, queries, yield* CurrentViewer);
							return live.subscribe(subscription, rerunQuery(Notes.application, options));
						}),
					),
		).pipe(Layer.provide(application)),
	);
	const runtime = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() });
	runtime.addGlobalLayer(Layer.mergeAll(Layer.succeed(Clock.Clock, clock), Layer.succeed(Digest.Digest, digest)));
	const protocol = layerMemoryProtocol(Notes).pipe(Layer.provide(handlers.pipe(Layer.provide(Layer.succeed(Access, access)))));
	const api = makeClient({ deniedLive: Notes }, { protocol, runtime }).api.deniedLive;
	return {
		access,
		announce: () => reactivity.invalidate(invalidationKeys([notes.item("private"), notes.item("private-details"), notes.item("private-counts")])),
		api,
		requests,
		response,
		status: api[LiveConnection].status,
	};
});
