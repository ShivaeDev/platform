import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Deferred, Effect, Queue, Redacted, SubscriptionRef } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { connect } from "#test/compared-postgres/connect.ts";
import { migrations } from "#test/compared-postgres/feature.ts";
import { independentVerbs } from "#test/compared-postgres/independentVerbs.ts";
import { openHost } from "#test/compared-postgres/openHost.ts";
import { openScreen } from "#test/compared-postgres/openScreen.ts";
import { transport } from "#test/compared-postgres/transport.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");
const layer = makePostgresTestLayer({
	migrations: { ...migrations, lockTimeout: "5 seconds" },
	url: Redacted.make(url ?? "postgresql://disabled"),
});

const create = Effect.gen(function* () {
	Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
	const database = yield* PostgresTestDatabase;
	const host = yield* openHost(database.url);
	const wire = transport();
	const runtime = yield* storyRuntime;
	const client = connect(host.url, wire.layer, true, runtime);
	const writer = connect(host.url, layerWebSocketConstructor, false, runtime);
	const writerRegistry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(registry) => Effect.sync(() => registry.dispose()),
	);
	const screen = yield* Effect.acquireRelease(
		Effect.promise(() => openScreen(client)),
		(view) => Effect.promise(view.unmount),
	);
	const query = client.api.list.query(undefined);
	yield* Effect.promise(() => act(async () => void (await Effect.runPromise(AtomRegistry.getResult(screen.registry, query)))));
	const other: { screen?: Awaited<ReturnType<typeof openScreen>> } = {};
	return { client, host, other, query, screen, wire, writer, writerRegistry };
});
export type Engine = Effect.Success<typeof create>;

const commit = Effect.fnUntraced(function* (engine: Engine, id: number, title: string) {
	const write = engine.writer.Client.runtime.atom(engine.writer.api.rename.run({ id, title }));
	yield* AtomRegistry.getResult(engine.writerRegistry, write);
	yield* Queue.take(engine.host.notifications);
});

function displayed(engine: Engine, title: string) {
	return Effect.promise(() =>
		act(async () => {
			await Effect.runPromise(
				until(
					AtomRegistry.toStream(engine.screen.registry, engine.query),
					(result) => AsyncResult.isSuccess(result) && result.value.some((note) => note.title === title),
					{
						name: `pushed title ${title}`,
					},
				),
			);
		}),
	);
}

export const comparedPostgres = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: () => create,
	inspect: (engine) => ({ requests: engine.wire.requests, results: engine.wire.results, screen: engine.screen.container.textContent }),
	layer,
	name: "compared PostgreSQL queries in React over WebSocket",
	runIf: configured,
	stages: ["transport"],
	verbs: (engine, story) => ({
		...independentVerbs(engine),
		clientRequests: () => Effect.sync(() => [...engine.wire.requests]),
		commit: (id: number, title: string) => {
			story.tell(`a repository command commits note ${id} as ${title}`);
			return Effect.promise(() => act(async () => void (await Effect.runPromise(commit(engine, id, title)))));
		},
		commitRepeatedly: (count: number) => {
			story.tell(`a repository command commits ${count} successive titles while socket acknowledgements are held`);
			return Effect.gen(function* () {
				for (let edit = 1; edit <= count; edit += 1) {
					yield* commit(engine, 1, `Visible edit ${edit}`);
				}
			});
		},
		denied: () =>
			Effect.promise(() =>
				act(async () => {
					await Effect.runPromise(
						until(AtomRegistry.toStream(engine.screen.registry, engine.query), (result) => AsyncResult.isFailure(result), {
							name: "subscription denied",
						}),
					);
				}),
			),
		denyRead: () =>
			Effect.sync(() => {
				engine.host.control.allowed = false;
			}),
		displayed: (title: string) => displayed(engine, title),
		holdNextRead: () =>
			Effect.sync(() => {
				engine.host.control.read = engine.host.hold;
			}),
		holdPolicy: () =>
			Effect.sync(() => {
				engine.host.control.policy = engine.host.hold;
			}),
		reads: () => SubscriptionRef.get(engine.host.reads),
		releaseRerun: () => Effect.promise(() => act(async () => void (await Effect.runPromise(Deferred.succeed(engine.host.released, undefined))))),
		rerunStarted: () => Deferred.await(engine.host.entered),
		results: () => Effect.sync(() => [...engine.wire.results]),
		resultValues: () =>
			Effect.sync(() =>
				engine.wire.results.flatMap((update) =>
					typeof update === "object" && update !== null && "_tag" in update && update._tag === "Result" && "value" in update ? [update.value] : [],
				),
			),
		resume: () => {
			story.tell("the socket resumes sending the held native RPC acknowledgements");
			return Effect.promise(() => act(async () => engine.wire.resume()));
		},
		shown: () => Effect.sync(() => engine.screen.container.querySelector("output")?.textContent),
		sockets: () => Effect.sync(engine.wire.sockets),
		untilReads: (count: number) => until(SubscriptionRef.changes(engine.host.reads), (reads) => reads >= count, { name: "server query reruns" }),
	}),
});

export function stalledTransport() {
	return comparedPostgres.trait(
		"transport",
		"the socket withholds the acknowledgement for Visible held, stalling server delivery",
		function* (engine) {
			engine.wire.stall();
			yield* Effect.promise(() => act(async () => void (await Effect.runPromise(commit(engine, 1, "Visible held")))));
			yield* Deferred.await(engine.wire.acknowledgementHeld);
			yield* displayed(engine, "Visible held");
		},
	);
}
