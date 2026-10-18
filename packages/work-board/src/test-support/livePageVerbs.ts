import { statSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { openLive, paragraphOf } from "./live.ts";
import { type BoardEngine, connected, rememberReader, served } from "./storyEngine.ts";

export function livePageVerbs(engine: BoardEngine, tell: (line: string) => void) {
	function stream() {
		const value = connected(engine).page.streams[0];
		if (!value) {
			throw new Error("No live subscription is connected");
		}
		return value;
	}
	return {
		ageFile: (path: string, seconds: number) => {
			tell(`an outside process dates ${path} ${seconds} seconds earlier`);
			const file = join(engine.notes.root, path);
			const time = statSync(file).mtimeMs / 1000 - seconds;
			utimesSync(file, time, time);
		},
		dropConnection: () => {
			tell("the live connection drops");
			stream().drop();
		},
		liveStatus: () => {
			tell("the reader observes the page's live status");
			return connected(engine).page.document.getElementById("live")?.textContent;
		},
		openDetails: (index: number) => {
			tell(`the reader expands details block ${index + 1}`);
			const details = connected(engine).page.document.querySelectorAll("#doc article details")[index];
			if (!details) {
				throw new Error(`Missing details block ${index + 1}`);
			}
			details.setAttribute("open", "");
		},
		openLivePage: Effect.fn("Story.openLivePage")(function* (path: string, beforeScripts?: Parameters<typeof openLive>[2]) {
			tell(`the reader opens the live page ${path}`);
			const { board, client } = served(engine);
			const page = yield* openLive(board, path, beforeScripts);
			engine.live = { board, client, page };
			yield* rememberReader(engine);
			return page;
		}),
		paragraph: (text: string) => {
			tell(`the reader finds the paragraph ${JSON.stringify(text)}`);
			return paragraphOf(connected(engine).page, text);
		},
		reconnect: () => {
			tell("the live connection becomes available again");
			stream().connect();
		},
		requestResync: () => {
			tell("the live connection asks the page to reconcile");
			stream().emit("change");
		},
	};
}
