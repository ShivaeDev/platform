import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { settleScreen } from "#test/settleScreen.ts";
import { connect } from "./connect.ts";
import { busy, type Engine } from "./engine.ts";

export function automaticVerbs(engine: Engine) {
	function say(line: string) {
		engine.narrator.tell(line);
	}
	function settle(container: () => HTMLElement = () => engine.screen.container) {
		return Effect.suspend(() => settleScreen(container(), () => busy(container()), say));
	}
	function refreshed(id: number, change: Effect.Effect<unknown>, container?: () => HTMLElement) {
		return Effect.gen(function* () {
			const read = engine.screen.nextResult(id, container?.());
			const run = Effect.runPromiseWith(yield* Effect.context());
			yield* Effect.promise(() =>
				act(async () => {
					await run(change);
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
				const client = websocket ? connect(url, layerWebSocketConstructor, engine.runtime) : connect(url, undefined, engine.runtime);
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
			return refreshed(2, click("Show second"));
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
