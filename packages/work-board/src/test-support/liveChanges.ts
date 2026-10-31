import { Effect, type Scope } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import type { RunningBoard } from "./board.ts";
import { rpcDocument, rpcWatcher, subscribe } from "./nativeRpc.ts";

export type Change = "resync" | readonly string[];

export interface ChangeSubscription {
	readonly close: () => Effect.Effect<void>;
	readonly next: () => Effect.Effect<Change, unknown>;
}

function keyName(key: Key) {
	const collection = key.collection.replace(/^work-board\//u, "");
	if (key._tag === "Item") {
		if (collection === "documents") {
			return key.id === "" ? "home document" : `document ${key.id}`;
		}
		return collection === "identities" ? `identity ${key.id}` : `${collection} ${key.id}`;
	}
	if (key._tag === "Bucket") {
		return collection === "index" ? "workspace index" : `${collection} ${key.field} ${key.value}`;
	}
	return `${collection} list`;
}

export function changeOf(hint: LiveHint): Change {
	return hint._tag === "Resync" ? "resync" : [...new Set(hint.keys.map(keyName))].sort((left, right) => left.localeCompare(right));
}

export function names(change: Change, path: string) {
	return change === "resync" || change.includes(`document ${path}`);
}

export const changeSubscription = Effect.fn("Test.changeSubscription")(function* (
	board: Pick<RunningBoard, "url">,
	indexOnly = false,
): Effect.fn.Return<ChangeSubscription, unknown, Scope.Scope> {
	const events = yield* subscribe(board, indexOnly);
	return { close: events.close, next: () => Effect.map(events.next(), changeOf) };
});

export const changeNaming = Effect.fn("Test.changeNaming")(function* (subscription: ChangeSubscription, path: string) {
	for (;;) {
		const change = yield* subscription.next();
		if (names(change, path)) {
			return change;
		}
	}
});

// macOS replays file events for files created just before a watch starts, so a change naming a path can predate the write under test.
export const changeShowing = Effect.fn("Test.changeShowing")(function* (
	subscription: ChangeSubscription,
	board: Pick<RunningBoard, "url">,
	path: string,
	text: string,
) {
	for (;;) {
		const change = yield* changeNaming(subscription, path);
		if ((yield* rpcDocument(board, `/${path}`)).source.includes(text)) {
			return change;
		}
	}
});

// The board sets its watcher state before it publishes the watcher change, so the state read after that change is current.
export const watcherChange = Effect.fn("Test.watcherChange")(function* (subscription: ChangeSubscription, board: RunningBoard, watching: boolean) {
	for (;;) {
		const change = yield* subscription.next();
		if (change !== "resync" && change.includes("watcher list") && (yield* rpcWatcher(board)).watching === watching) {
			return;
		}
	}
});
