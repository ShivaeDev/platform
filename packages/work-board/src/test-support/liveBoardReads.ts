import { STATUS_CODES } from "node:http";
import { Cause, Effect, Exit } from "effect";
import type { RawResponse, RunningBoard } from "./board.ts";
import { liveState, present } from "./liveState.ts";
import { rpcCall, rpcWatcher } from "./nativeRpc.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export function boardIndex(board: Pick<RunningBoard, "url">) {
	return rpcCall(board, (client) => client("work-board.index", undefined));
}

export function watching(engine: BoardEngine) {
	return Effect.map(rpcWatcher(served(engine).board), (watcher) => (watcher.watching ? "watching" : "not watching"));
}

export function ended(exit: Exit.Exit<unknown, unknown>) {
	if (Exit.isSuccess(exit)) {
		return "finished";
	}
	return Cause.hasInterrupts(exit.cause) ? "interrupted" : `failed: ${Cause.pretty(exit.cause)}`;
}

export function fontFamily(font: string) {
	if (font.includes("geist-mono-latin-wght")) {
		return "Geist Mono";
	}
	return font.includes("geist-latin-wght") ? "Geist" : "other fonts";
}

export function answerOf({ body, status }: RawResponse) {
	if (status === 200) {
		return body.includes("data-board-react-root") ? "reading shell" : body.trim().slice(0, 80);
	}
	return `${status} ${STATUS_CODES[status] ?? "unknown status"}`;
}

export function liveBoardReads(engine: BoardEngine) {
	const state = liveState(engine);
	function subscription(client: string) {
		return present(state.subscriptions.get(client), `${client} has not subscribed to changes; add liveClientSubscribed or call clientSubscribes`);
	}
	function parsing() {
		return present(state.parsed, "The story does not observe record parsing; add recordParsingObserved");
	}
	function agent() {
		state.agent ??= { root: engine.notes.root };
		return state.agent;
	}
	function goals() {
		const { client } = served(engine);
		return Effect.promise(() => client.run(client.api.goals.run()));
	}
	function owned() {
		return present(state.owned, "The board has no owner fiber; add boardOwnedByFiber");
	}
	function failingWatcher() {
		return present(state.watcher, "The story's watcher cannot fail; add watcherCanFail");
	}
	return { agent, failingWatcher, goals, owned, parsing, state, subscription };
}
