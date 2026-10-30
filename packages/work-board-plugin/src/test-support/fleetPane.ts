import { Clock, Effect } from "effect";
import { boardHttp } from "@shivaedev/work-fleet/test-support/boardHttp.ts";
import type { HostStoryEngine } from "@shivaedev/work-fleet/test-support/HostStoryEngine.ts";
import { host } from "@shivaedev/work-fleet/test-support/hostStory.ts";
import { boardInit, readBoard } from "#board.ts";
import { answersTo, overview } from "#boardTools.ts";
import { rpcInit } from "#rpc.ts";
import { legacyFleetBoard } from "#test/legacyFleetBoard.ts";
import { agentsShown, goalLines, inFlightShown } from "#test/paneReadouts.ts";
import { createPane } from "#test/pluginPane.ts";

type HostStory = Parameters<NonNullable<Parameters<typeof host.it>[2]>>[0]["story"];

const omitsExecution = new WeakSet<HostStoryEngine>();

export const fleetOmitsExecution = host.trait(
	"configuration",
	"Fleet's wire reply omits the execution details, as older Fleet daemons send it",
	(engine) => {
		omitsExecution.add(engine);
	},
);

export const openPane = Effect.fnUntraced(function* ({ engine, tell }: HostStory) {
	tell("open the plugin pane on the Board, served over HTTP against the running Fleet daemon");
	const directory = engine.fixture.host.boardDir;
	const board = omitsExecution.has(engine) ? yield* legacyFleetBoard(engine) : yield* boardHttp(directory, undefined, undefined, engine.running.port);
	const pane = yield* createPane();
	let fleetPort: number | undefined;
	async function ask(init: ReturnType<typeof boardInit>) {
		const response = await fetch(`${board.url}/_board/rpc`, init);
		return { headers: {}, ok: response.ok, status: response.status, text: await response.text() };
	}
	const refreshed = Effect.gen(function* () {
		const now = yield* Clock.currentTimeMillis;
		const reply = yield* Effect.promise(() => ask(boardInit(directory)));
		yield* pane.render(readBoard(reply, directory, now));
		return pane.container;
	});
	return {
		agentsOf: (title: string) => {
			tell(`refresh the pane and read the agents of ${title} in flight`);
			return Effect.map(refreshed, (container) => agentsShown(container, title, { turns: false }));
		},
		goals: () => {
			tell("refresh the pane and read its Goals section");
			return Effect.map(refreshed, goalLines);
		},
		inFlight: () => {
			tell("refresh the pane and read its In flight section");
			return Effect.map(refreshed, inFlightShown);
		},
		overviewFleet: () =>
			Effect.gen(function* () {
				tell("read Fleet from board_overview");
				const now = yield* Clock.currentTimeMillis;
				const { fleet } = yield* Effect.promise(() =>
					overview({ ask: async (requests) => answersTo(requests, (await ask(rpcInit(directory, requests))).text, directory), now }),
				);
				return "items" in fleet ? { state: fleet.state, work: fleet.items.map(({ title, workId }) => ({ title, workId })) } : fleet;
			}),
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
