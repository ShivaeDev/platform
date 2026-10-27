import { Clock, Effect } from "effect";
import { boardInit, readBoard } from "#board.ts";
import { answersTo, overview } from "#boardTools.ts";
import { rpcInit } from "#rpc.ts";
import { createPane } from "#test/pluginPane.ts";

export const fleetPane = Effect.fnUntraced(function* (url: string, directory: string) {
	const pane = yield* createPane();
	async function ask(init: ReturnType<typeof boardInit>) {
		const response = await fetch(`${url}/_board/rpc`, init);
		return { headers: {}, ok: response.ok, status: response.status, text: await response.text() };
	}
	return {
		overview: () =>
			Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				return yield* Effect.promise(() =>
					overview({
						ask: async (requests) => answersTo(requests, (await ask(rpcInit(directory, requests))).text, directory),
						now,
					}),
				);
			}),
		refresh: () =>
			Effect.gen(function* () {
				const now = yield* Clock.currentTimeMillis;
				const reply = yield* Effect.promise(() => ask(boardInit(directory)));
				const board = readBoard(reply, directory, now);
				yield* Effect.promise(() => pane.render(board));
				return board;
			}),
		screen: () => pane.container,
	};
});
