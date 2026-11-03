import { Clock, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { boardHttp } from "@shivaedev/work-fleet/test-support/boardHttp.ts";
import type { HostStoryEngine } from "@shivaedev/work-fleet/test-support/HostStoryEngine.ts";
import { host, hostDefinition } from "@shivaedev/work-fleet/test-support/hostStory.ts";
import { boardInit, readBoard } from "#board.ts";
import { answersTo, overview } from "#boardTools.ts";
import { rpcInit } from "#rpc.ts";
import { areaReadouts } from "#test/areaReadouts.ts";
import { legacyFleetBoard } from "#test/legacyFleetBoard.ts";
import { agentsShown, goalLines, inFlightShown } from "#test/paneReadouts.ts";
import { createPane } from "#test/pluginPane.ts";

const omitsExecution = new WeakSet<HostStoryEngine>();

export const fleetOmitsExecution = host.trait(
	"configuration",
	"Fleet's wire reply omits the execution details, as older Fleet daemons send it",
	(engine) => {
		omitsExecution.add(engine);
	},
);

const openFleetPane = Effect.fnUntraced(function* (engine: HostStoryEngine, tell: (line: string) => void) {
	tell("open the plugin pane on the Board, served over HTTP against the running Fleet daemon");
	const directory = engine.fixture.host.boardDir;
	const board = omitsExecution.has(engine) ? yield* legacyFleetBoard(engine) : yield* boardHttp(directory, undefined, undefined, engine.running.port);
	const pane = yield* createPane();
	let fleetPort: number | undefined;
	async function ask(init: ReturnType<typeof boardInit>) {
		const response = await fetch(`${board.url}/_board/rpc`, init);
		return { headers: {}, ok: response.ok, status: response.status, text: await response.text() };
	}
	let fleet: Awaited<ReturnType<typeof overview>>["fleet"];
	const refreshed = Effect.gen(function* () {
		const now = yield* Clock.currentTimeMillis;
		const reply = yield* Effect.promise(() => ask(boardInit(directory)));
		yield* pane.render(readBoard(reply, directory, now));
		({ fleet } = yield* Effect.promise(() =>
			overview({ ask: async (requests) => answersTo(requests, (await ask(rpcInit(directory, requests))).text, directory), now }),
		));
	});
	yield* refreshed;
	return {
		...areaReadouts(pane.container, tell),
		agentsOf: (title: string) => {
			tell(`read the agents of ${title} in flight`);
			return Effect.sync(() => agentsShown(pane.container, title, { turns: false }));
		},
		goals: () => {
			tell("read the pane’s Goals section");
			return Effect.sync(() => goalLines(pane.container));
		},
		inFlight: () => {
			tell("read the pane’s In flight section");
			return Effect.sync(() => inFlightShown(pane.container));
		},
		overviewFleet: () =>
			Effect.sync(() => {
				tell("read Fleet from the last board_overview reply");
				return "items" in fleet ? { state: fleet.state, work: fleet.items.map(({ title, workId }) => ({ title, workId })) } : fleet;
			}),
		refresh: () => {
			tell("refresh the pane from the Board");
			return refreshed;
		},
		restartFleet: () =>
			Effect.suspend(() => {
				if (fleetPort === undefined) {
					throw new Error("Stop the Fleet daemon before restarting it");
				}
				tell(`restart the Fleet daemon on its port ${fleetPort}`);
				return engine.start(fleetPort);
			}),
		stopFleet: () =>
			Effect.suspend(() => {
				tell("stop the Fleet daemon");
				fleetPort = engine.running.port;
				return engine.stop();
			}),
	};
});

export const pluginFleet = storyKit({
	...hostDefinition,
	name: "plugin Fleet pane",
	verbs: (engine, story) => ({ ...hostDefinition.verbs(engine, story), openPane: () => openFleetPane(engine, story.tell) }),
});
