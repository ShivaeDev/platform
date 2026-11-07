import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Deferred, Effect, Queue, Redacted, SubscriptionRef } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { loadQuery } from "#adapters/loadQuery.ts";
import { migrations } from "#test/compared-postgres/feature.ts";
import { transport } from "#test/compared-postgres/transport.ts";
import { Api, openHost } from "#test/initial-postgres/host.ts";
import { blankScreen, displayed } from "#test/initial-postgres/readouts.ts";
import { Screen } from "#test/initial-postgres/Screen.tsx";
import { storyRuntime } from "#test/storyRuntime.ts";

const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");
const layer = makePostgresTestLayer({ migrations: { ...migrations, lockTimeout: "5 seconds" }, url: Redacted.make(url ?? "postgresql://disabled") });

export const initialPostgres = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	*create() {
		Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
		const database = yield* PostgresTestDatabase;
		const host = yield* openHost(database.url);
		const wire = transport();
		const runtime = yield* storyRuntime;
		const client = makeClient(Api, { runtime, url: host.url, webSocketConstructor: wire.layer });
		const writer = makeClient(Api, { live: false, runtime, url: host.url, webSocketConstructor: layerWebSocketConstructor });
		const writerRegistry = yield* Effect.acquireRelease(
			Effect.sync(() => AtomRegistry.make()),
			(registry) => Effect.sync(() => registry.dispose()),
		);
		const screen = yield* blankScreen;
		return { client, host, screen, state: { allowed: true, title: "Visible first" }, wire, writer, writerRegistry };
	},
	inspect: ({ wire, screen }) => ({ requests: wire.requests, results: wire.results, screen: screen.container.textContent }),
	layer,
	name: "initial PostgreSQL query in React",
	runIf: configured,
	stages: ["opening"],
	verbs: (engine, story) => ({
		commit: (title: string) => {
			story.tell(`a repository command commits the title ${title}`);
			engine.state.title = title;
			return Effect.gen(function* () {
				yield* AtomRegistry.getResult(engine.writerRegistry, engine.writer.runtime.atom(engine.writer.api.rename.run({ title })));
				yield* Queue.take(engine.host.notifications);
			});
		},
		firstReadEntered: () => Deferred.await(engine.host.entered),
		loadRoute: () => {
			story.tell("the route loader loads the live query in the screen's registry");
			return Effect.promise(() =>
				loadQuery(engine.screen.registry, engine.client.api.read.query({ allowed: true }), { abortController: new AbortController() }),
			);
		},
		open: () => {
			story.tell("the screen opens its live query");
			return Effect.promise(() => engine.screen.render(<Screen query={engine.client.api.read.query({ allowed: engine.state.allowed })} />));
		},
		reads: () => SubscriptionRef.get(engine.host.reads),
		releaseRead: () => {
			story.tell("the server releases its first query read");
			return Deferred.succeed(engine.host.released, undefined);
		},
		requests: () => Effect.sync(() => [...engine.wire.requests]),
		results: () => Effect.sync(() => [...engine.wire.results]),
		settled: () => displayed(engine.screen, engine.client.api.read.query({ allowed: engine.state.allowed }), engine.state.title),
		shown: () => Effect.sync(() => engine.screen.container.querySelector("output")?.textContent),
	}),
});

export const denied = initialPostgres.trait("opening", "the query's policy denies the read", ({ state }) => {
	state.allowed = false;
});
export function held(at: "before" | "after") {
	return initialPostgres.trait("opening", `the first SQL read is held ${at} its snapshot`, ({ host }) => {
		host.held[at] = true;
	});
}
