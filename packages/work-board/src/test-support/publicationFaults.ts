import { readdirSync, readFileSync } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { join } from "node:path";
import { Effect, Order } from "effect";
import { Window } from "happy-dom";
import type { HandoffInput } from "#browser/handoffs/schema.ts";
import { documents } from "#rpc/keys.ts";
import type { Folder } from "./board.ts";
import type { heldRegisteredRead } from "./heldRegisteredRead.ts";
import { subscribe } from "./nativeRpc.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export interface PublicationSetup {
	answer?: Promise<unknown>;
	folder?: FileHandle;
	handoffDraft?: HandoffInput;
	heldSave?: ReturnType<typeof heldRegisteredRead>;
	outside?: Folder;
	readsNoted?: number;
}

const setups = new WeakMap<BoardEngine, PublicationSetup>();

export function publicationSetup(engine: BoardEngine) {
	const known = setups.get(engine);
	if (known) {
		return known;
	}
	const created: PublicationSetup = {};
	setups.set(engine, created);
	return created;
}

export function entriesOf(path: string) {
	try {
		return readdirSync(path).sort(Order.String);
	} catch {
		return "missing";
	}
}

export function textOf(path: string) {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return "missing";
	}
}

export function projectPath(engine: BoardEngine, path: string) {
	return join(engine.notes.root, path);
}

// The server's first hint is the Resync it sends once the subscription listens; after the change, hints naming every path, a Bucket or a Resync mean the index read it.
export const changedOutside = Effect.fn("Story.changedOutside")(function* (engine: BoardEngine, paths: readonly string[], change: () => void) {
	const events = yield* subscribe(served(engine).board);
	yield* events.next();
	change();
	const unseen = new Set(paths);
	while (unseen.size > 0) {
		const hint = yield* events.next();
		if (hint._tag === "Resync") {
			break;
		}
		for (const key of hint.keys) {
			if (key._tag === "Bucket") {
				unseen.clear();
			} else if (key._tag === "Item" && key.collection === documents.name) {
				unseen.delete(String(key.id));
			}
		}
	}
	yield* events.close();
});

export function markup(html: string) {
	const window = new Window();
	window.document.body.innerHTML = html;
	return window.document;
}

export function textIn(element: { textContent: string | null } | null | undefined) {
	return element?.textContent?.replace(/\s+/gu, " ").trim();
}
