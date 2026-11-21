import { layerWebSocketConstructor } from "@effect/platform-node/NodeSocket";
import { Clock, Context, Effect, Layer, Option, Stream } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcGroup } from "effect/rpc";
import { invalidationKeys } from "@shivaedev/changes/keys.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { type DelegationRule, Subject } from "@shivaedev/identity/subject.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { clientActivity } from "#clientActivity.ts";
import { liveServerLayer } from "#live-server/layer.ts";
import { makeClient } from "#makeClient.ts";
import { SocketClock } from "#SocketClock.ts";
import { coaching, Journal, journals, type NotYourClient } from "#test/record-client/Journal.ts";
import { Shelf } from "#test/record-client/Shelf.ts";
import { Tally } from "#test/record-client/Tally.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

const Coaching = Context.Service<typeof coaching.service, DelegationRule<NotYourClient>>(coaching.service);

// The coach signs in with a bearer token; a page's client that sends none has no session.
const sessions = SessionPolicy.of({
	origin: () => true,
	provider: {
		get: (headers) =>
			Effect.succeed(
				Option.map(Option.fromUndefinedOr(headers.authorization?.replace(/^Bearer /u, "")), (id) => ({
					user: { email: `${id}@example.test`, emailVerified: true, id, name: id },
				})),
			),
	},
});

export const recordClientEngine = Effect.gen(function* () {
	const runtime = yield* storyRuntime;
	runtime.addGlobalLayer(Layer.succeed(SocketClock, yield* Clock.Clock));
	const titles: readonly string[] = [];
	const stored = { count: 0, journals: new Map<string, readonly string[]>(), titles };
	function entries(account: string) {
		return `${account}: ${(stored.journals.get(account) ?? []).join(", ")}`;
	}
	const reactivity = yield* Reactivity.make;
	const handlers = Layer.mergeAll(
		Journal.application.toLayer({
			"journal.entries": () => Effect.map(Subject, ({ id }) => entries(id)),
			"journal.owner": () => Stream.fromEffect(Effect.map(Subject, ({ id }) => id)),
			"journal.write": ({ entry }) =>
				Effect.flatMap(Subject, ({ id }) =>
					Effect.sync(() => {
						stored.journals.set(id, [...(stored.journals.get(id) ?? []), entry]);
					}),
				),
		}),
		Shelf.application.toLayer({
			"shelf.shelve": ({ title }) =>
				Effect.sync(() => {
					stored.titles = [...stored.titles, title];
				}),
			"shelf.titles": () => Effect.sync(() => stored.titles),
		}),
		Tally.application.toLayer({
			"tally.bump": () =>
				Effect.sync(() => {
					stored.count += 1;
				}),
			"tally.count": () => Effect.sync(() => stored.count),
		}),
	);
	const services = yield* Layer.build(
		appHost({
			config: { port: 0 },
			group: RpcGroup.make().merge(Journal, Shelf, Tally),
			handlers,
			services: Layer.merge(liveServerLayer, Layer.succeed(Coaching, { allows: () => Effect.succeed(true) })).pipe(
				Layer.provideMerge(Layer.succeed(Reactivity.Reactivity, reactivity)),
			),
			sessions: Layer.succeed(SessionPolicy, sessions),
		}),
	);
	const server = Context.get(services, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected a TCP listener");
	}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const origin = `http://127.0.0.1:${server.address.port}`;
	const options = { runtime, webSocketConstructor: layerWebSocketConstructor };
	const client = makeClient(
		{ journal: Journal, shelf: Shelf, tally: Tally },
		{ ...options, bearerToken: Effect.succeed("coach"), url: `${origin}/rpc` },
	);
	const views = { count: client.api.tally.count.query(), titles: client.api.shelf.titles.query() };
	// Another tab of the account writes to its own journal, so the change reaches this client only as a live update.
	function writtenElsewhere(account: string, entry: string) {
		return Effect.sync(() => {
			stored.journals.set(account, [...(stored.journals.get(account) ?? []), entry]);
		}).pipe(Effect.andThen(Reactivity.invalidate(invalidationKeys([journals.list]))), Effect.provideService(Reactivity.Reactivity, reactivity));
	}
	return { activity: clientActivity(client), client, options, origin, registry, views, writtenElsewhere };
});

export type RecordClientEngine = Effect.Success<typeof recordClientEngine>;
