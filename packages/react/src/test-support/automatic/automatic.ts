import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Duration, Effect, Redacted } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { TestClock } from "effect/testing";
import { act } from "react";
import { postgresTestUrl } from "@shivaedev/test-sql/server/adapters/postgresTestUrl.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { until } from "@shivaedev/test-story/server/until.ts";
import { untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { connect } from "./connect.ts";
import { busy, type Engine, live, open } from "./engine.ts";
import { migrations } from "./feature.ts";

const { url: databaseUrl, configured } = postgresTestUrl("PLATFORM_SQL_TEST_DATABASE_URL");
const layer = makePostgresTestLayer({
	migrations: { ...migrations, lockTimeout: "5 seconds" },
	url: Redacted.make(databaseUrl ?? "postgresql://disabled"),
});

function automaticVerbs(engine: Engine) {
	function say(line: string) {
		engine.narrator.tell(line);
	}
	function settle(container: () => HTMLElement = () => engine.screen.container) {
		return Effect.suspend(() => settleScreen(container(), () => busy(container()), say));
	}
	function refreshed(id: number, change: Effect.Effect<unknown>, container?: () => HTMLElement, coalesces = true) {
		return Effect.gen(function* () {
			const read = engine.host.nextRead(id);
			const run = Effect.runPromiseWith(yield* Effect.context());
			yield* Effect.promise(() =>
				act(async () => {
					await run(change);
					if (coalesces) {
						await run(untilTimer("20 millis"));
						await run(TestClock.adjust("20 millis"));
					}
					await read;
				}),
			);
			yield* settle(container);
		});
	}
	function command(url: string, id: number, title: string, websocket: boolean) {
		return Effect.acquireUseRelease(
			Effect.sync(() => AtomRegistry.make()),
			(registry) => {
				const client = websocket ? connect(url, layerWebSocketConstructorWS, engine.runtime) : connect(url, undefined, engine.runtime);
				return Effect.promise(() =>
					act(async () => Effect.runPromise(AtomRegistry.getResult(registry, client.runtime.atom(client.api.rename.run({ id, title }))))),
				);
			},
			(registry) => Effect.sync(() => registry.dispose()),
		);
	}
	function worker(id: number, title: string, rollback: boolean) {
		return Effect.promise(() => act(async () => engine.worker.write(id, title, rollback))).pipe(
			Effect.flatMap((result) =>
				result === (rollback ? "Failure" : "Success") ? Effect.void : Effect.die(new Error(`The worker reported ${result}`)),
			),
		);
	}
	function click(label: string) {
		return Effect.promise(() => engine.screen.click(label));
	}
	return {
		anotherHostRenames: (id: number, title: string) => {
			say(`another host renames note ${id} to ${title}`);
			return command(engine.secondHost.url, id, title, true);
		},
		anotherHostRenamesShown: (id: number, title: string, container?: () => HTMLElement) => {
			say(`another host renames note ${id} to ${title}`);
			return refreshed(id, command(engine.secondHost.url, id, title, true), container);
		},
		commandRenames: (id: number, title: string) => {
			say(`a command on this host renames note ${id} to ${title}`);
			return refreshed(id, command(engine.host.url, id, title, false));
		},
		dropSocket: () => {
			say("the tab's socket drops");
			return Effect.promise(engine.screen.drop).pipe(
				Effect.andThen(
					Effect.suspend(() =>
						settleScreen(engine.screen.container, () => engine.screen.container.querySelector('[role="status"]')?.textContent === "live", say),
					),
				),
			);
		},
		hideSecond: () => {
			say("hide the second note's query");
			return click("Hide second");
		},
		settle,
		showSecond: () => {
			say("show the second note's query again");
			return refreshed(2, click("Show second"), undefined, false);
		},
		workerCommits: (id: number, title: string) => {
			say(`a pg-boss worker commits note ${id} as ${title}`);
			return refreshed(id, worker(id, title, false));
		},
		workerRollsBack: (id: number, title: string) => {
			say(`a pg-boss worker renames note ${id} to ${title} and rolls back`);
			return worker(id, title, true);
		},
	};
}

export const automatic = storyKit({
	around: withIsolatedDatabase,
	clock: "test",
	create: open,
	inspect: ({ host, screen }) => ({ publications: host.publications, reads: host.reads, text: screen.container.textContent }),
	layer,
	name: "automatic live queries",
	runIf: configured,
	stages: ["screen"],
	verbs: (engine, story) => {
		engine.narrator.tell = story.tell;
		const verbs = automaticVerbs(engine);
		return {
			...verbs,
			closeFirstScreen: () => {
				story.tell("close the first screen and its registry");
				return Effect.promise(engine.screen.closePrimary);
			},
			connection: () => Effect.sync(() => engine.screen.container.querySelector('[role="status"]')?.textContent),
			notifications: () => engine.delivered,
			notifiedKeys: () => Effect.map(engine.delivered, (notifications) => notifications.flat()),
			openSeparateScreen: () => {
				story.tell("open another screen for note 2 in an independent registry");
				return Effect.promise(engine.screen.openSeparate).pipe(Effect.andThen(verbs.settle(engine.screen.separateContainer)));
			},
			publications: () => Effect.sync(() => [...engine.host.publications]),
			queryValue: (id: number) => Effect.sync(() => (engine.screen.query(id) === engine.marked.get(id) ? "the same value" : "a new value")),
			reads: () => Effect.sync(() => engine.host.reads.toSorted()),
			reconnected: () => {
				story.tell("the client's retry interval passes and its socket reconnects");
				return Effect.gen(function* () {
					const run = Effect.runPromiseWith(yield* Effect.context());
					yield* Effect.promise(() => engine.screen.reconnected);
					yield* until(engine.clock.sleeps, (interval) => Duration.toMillis(interval) > 20, {
						name: "the live subscription's retry timer",
					});
					yield* Effect.promise(() => act(async () => run(TestClock.adjust("2 seconds"))));
					yield* live(engine);
				});
			},
			renameFromScreen: (title: string) => {
				story.tell(`rename note 1 to ${title} from the screen`);
				const read = engine.host.nextRead(1);
				return Effect.promise(() => engine.screen.rename(title)).pipe(
					Effect.andThen(Effect.promise(() => act(() => read))),
					Effect.andThen(verbs.settle()),
				);
			},
			separateRenamed: (title: string) => verbs.anotherHostRenamesShown(2, title, engine.screen.separateContainer),
			separateShown: () => Effect.sync(() => engine.screen.separateContainer().textContent),
			shown: (id: number) => Effect.sync(() => engine.screen.container.querySelector(`[data-note="${id}"]`)?.textContent),
			sockets: () =>
				Effect.sync(() => engine.screen.addresses.map((address) => (address === engine.host.url.replace(/^http/u, "ws") ? "tab socket" : address))),
		};
	},
});

export function notesShown() {
	return automatic.trait("screen", "alice's screen shows live notes First and Second", live);
}

export function secondHiddenThenRenamed() {
	return automatic.trait("screen", "alice hid the second note's query, and another host then renamed note 2 to While unmounted", function* (engine) {
		yield* live(engine);
		const { anotherHostRenames, hideSecond } = automaticVerbs(engine);
		yield* hideSecond();
		yield* anotherHostRenames(2, "While unmounted");
	});
}

export function firstRenamedByAnotherHost(title: string) {
	return automatic.trait("screen", `another host renamed note 1 to ${title} and alice's screen shows it`, function* (engine) {
		yield* live(engine);
		yield* automaticVerbs(engine).anotherHostRenamesShown(1, title);
		engine.marked.set(1, engine.screen.query(1));
	});
}

export function socketDropped(renamedWhileDown: boolean) {
	const rename = renamedWhileDown ? ", and another host renamed note 1 to Changed while disconnected" : "";
	return automatic.trait("screen", `alice's screen shows only note 1 and its socket dropped${rename}`, function* (engine) {
		yield* live(engine);
		const { anotherHostRenames, dropSocket, hideSecond } = automaticVerbs(engine);
		yield* hideSecond();
		yield* dropSocket();
		if (renamedWhileDown) {
			yield* anotherHostRenames(1, "Changed while disconnected");
		}
	});
}

export function separateScreenOpen(firstClosed: boolean) {
	const closed = firstClosed ? ", and the first screen was then closed" : "";
	return automatic.trait(
		"screen",
		`a second screen for note 2 runs in an independent registry beside alice's first screen${closed}`,
		function* (engine) {
			yield* live(engine);
			yield* Effect.promise(engine.screen.openSeparate);
			yield* automaticVerbs(engine).settle(engine.screen.separateContainer);
			if (firstClosed) {
				yield* Effect.promise(engine.screen.closePrimary);
			}
		},
	);
}

export function workerCommitted() {
	return automatic.trait("screen", "a pg-boss worker committed note 1 as From worker and alice's screen shows it", function* (engine) {
		yield* live(engine);
		yield* automaticVerbs(engine).workerCommits(1, "From worker");
	});
}
