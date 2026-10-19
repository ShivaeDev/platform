import { Effect } from "effect";
import { Window } from "happy-dom";
import { act } from "react";
import { vi } from "vitest";
import { mountBoard } from "#client/react/mountBoard.tsx";
import { session } from "#client/session.ts";
import { folder, startBoard } from "./board.ts";
import { EDGE_ATTENTION_SOURCE } from "./coverageEdges.ts";
import { decodedBody } from "./decodedBody.ts";
import { type ScreenEngine, screenView } from "./screenEngine.ts";

export const mountSession = Effect.fn("Story.mountSession")(function* (engine: ScreenEngine, kind: "response" | "handoff") {
	const notes = yield* Effect.acquireRelease(
		Effect.sync(() => folder({ "item.md": EDGE_ATTENTION_SOURCE })),
		(value) => Effect.sync(value.remove),
	);
	const board = yield* startBoard(notes.root, undefined, undefined, true);
	const previousFetch = globalThis.fetch;
	const transport = yield* Effect.acquireRelease(
		Effect.sync(
			() =>
				new Window({
					settings: { fetch: { interceptor: { afterAsyncResponse: ({ response, window }) => decodedBody(response, window) } } },
					url: board.url,
				}),
		),
		(value) =>
			Effect.promise(async () => {
				globalThis.fetch = previousFetch;
				await value.happyDOM.abort();
			}),
	);
	vi.stubGlobal("fetch", (...args: Parameters<Window["fetch"]>) => {
		const input = args[0];
		let url: string;
		if (typeof input === "string") {
			url = input;
		} else if ("url" in input) {
			url = input.url;
		} else {
			url = input.href;
		}
		transport.happyDOM.setURL(new URL(url, board.url).origin);
		return transport.fetch(...args);
	});
	const environment: Parameters<typeof session>[0] = {
		addEventListener: (type, listener) => window.addEventListener(type, listener),
		document,
		location: { origin: board.url },
		removeEventListener: (type, listener) => window.removeEventListener(type, listener),
	};
	const first = session(environment);
	const container = document.createElement("div");
	document.body.append(container);
	engine.container = container;
	history.replaceState(null, "", kind === "response" ? "/_board/item/item.edge/" : "/_board/handoff?item=item.edge");
	window.dispatchEvent(new PopStateEvent("popstate"));
	let unmount: (() => void) | undefined;
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			engine.lastView = screenView(engine);
			act(() => {
				unmount?.();
				window.dispatchEvent(new Event("pagehide"));
			});
			container.remove();
		}),
	);
	act(() => {
		unmount = mountBoard(container, () => session(environment));
	});
	return { container, environment, first, notes };
});
