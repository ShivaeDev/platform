import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect, Option, Redacted } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { TestClock } from "effect/testing";
import { act, createElement } from "react";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { render } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { Api, migrations } from "#test/session-repository/feature.ts";
import { Note } from "#test/session-repository/Note.tsx";
import { openHost } from "#test/session-repository/openHost.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

const { url, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");
const layer = makePostgresTestLayer({ migrations: { ...migrations, lockTimeout: "5 seconds" }, url: Redacted.make(url ?? "postgresql://disabled") });
type Mode = "get" | "compared";

const create = Effect.gen(function* () {
	Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
	const host = yield* openHost((yield* PostgresTestDatabase).url);
	const run = Effect.runPromiseWith(yield* Effect.context());
	return { host, run, screens: new Map<string, Effect.Success<ReturnType<typeof openScreen>>>() };
});

const openScreen = Effect.fnUntraced(function* (address: string, account: string, mode: Mode) {
	const screen = yield* Effect.acquireRelease(
		Effect.promise(() => render(null)),
		(view) => Effect.promise(view.unmount),
	);
	const client = makeClient(Api, {
		headers: { authorization: `Bearer ${account}-session` },
		registry: screen.registry,
		runtime: yield* storyRuntime,
		url: address,
		webSocketConstructor: layerWebSocketConstructor,
	});
	const query = client.api[mode].query({ id: 1 });
	yield* Effect.promise(() => screen.render(createElement(Note, { query })));
	yield* Effect.promise(() => act(async () => void (await Effect.runPromise(AtomRegistry.getResult(screen.registry, query)))));
	return { query, screen };
});

function awaitAnswer(account: string, current: Effect.Success<ReturnType<typeof openScreen>>, title: string) {
	return Effect.runPromise(
		until(
			AtomRegistry.toStream(current.screen.registry, current.query),
			(result) => !result.waiting && (account === "bob" ? AsyncResult.isFailure(result) : Option.contains(AsyncResult.value(result), title)),
			{ name: `${account}'s answer to the worker write` },
		),
	);
}

export const sessionRepository = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: () => create,
	inspect: ({ host, screens }) => ({ reads: host.reads, screens: [...screens].map(([name, { screen }]) => [name, screen.container.textContent]) }),
	layer,
	name: "session repository queries over authenticated PostgreSQL WebSocket",
	runIf: configured,
	stages: ["screens"],
	verbs: ({ host, run, screens }, story) => ({
		denyBob: () =>
			Effect.sync(() => {
				story.tell("bob loses permission to read the row");
				host.allowed.delete("bob");
			}),
		reads: (account: string) => Effect.sync(() => host.reads.filter((reader) => reader === account)),
		shown: (account: string) => Effect.sync(() => screens.get(account)?.screen.container.textContent),
		workerWrites: (title: string) => {
			story.tell(`a worker repository commits ${title} without a request identity or explicit invalidation`);
			return Effect.promise(() =>
				act(async () => {
					await Effect.runPromise(host.write(title));
					const answers = Promise.all([...screens].map(([account, current]) => awaitAnswer(account, current, title)));
					const completed = Effect.promise(() => answers);
					await run(
						Effect.raceFirst(completed, untilTimer("20 millis").pipe(Effect.andThen(TestClock.adjust("20 millis")), Effect.andThen(completed))),
					);
				}),
			);
		},
	}),
});

export function mountedSessions(mode: Mode) {
	return sessionRepository.trait("screens", `alice and bob mount the ${mode} query with read access`, function* ({ host, screens }) {
		for (const account of ["alice", "bob"]) {
			screens.set(account, yield* openScreen(host.url, account, mode));
		}
	});
}
