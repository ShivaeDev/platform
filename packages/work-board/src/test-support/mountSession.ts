import { Effect } from "effect";
import { Window } from "happy-dom";
import { act } from "react";
import { vi } from "vitest";
import { mountBoard } from "#client/react/mountBoard.tsx";
import { session } from "#client/session.ts";
import { folder, startBoard } from "./board.ts";
import { EDGE_ATTENTION_SOURCE } from "./coverageEdges.ts";
import { type ScreenEngine, screenView } from "./screenEngine.ts";
import { registerSessionFetch, sessionFetch } from "./sessionFetch.ts";

export const mountSession = Effect.fn("Story.mountSession")(function* (engine: ScreenEngine, kind: "response" | "handoff") {
	const files = Object.keys(engine.files).length > 0 ? engine.files : { "item.md": EDGE_ATTENTION_SOURCE };
	const notes = yield* Effect.acquireRelease(
		Effect.sync(() => folder(files)),
		(value) => Effect.sync(value.remove),
	);
	const board = yield* startBoard(notes.root, engine.options?.home, engine.sessionWrap, true, undefined, undefined, engine.sessionFleetPort);
	const previousFetch = globalThis.fetch;
	const transport = yield* Effect.acquireRelease(
		Effect.sync(() => new Window({ url: board.url })),
		(value) =>
			Effect.promise(async () => {
				globalThis.fetch = previousFetch;
				await value.happyDOM.abort();
			}),
	);
	const unregister = registerSessionFetch(board.url, transport, engine);
	yield* Effect.addFinalizer(() => Effect.sync(unregister));
	vi.stubGlobal("fetch", sessionFetch);
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
	const formRoute = kind === "response" ? "/_board/item/item.edge/" : "/_board/handoff?item=item.edge";
	const route = engine.path === "/" ? formRoute : engine.path;
	history.replaceState(null, "", route);
	window.dispatchEvent(new PopStateEvent("popstate"));
	let unmount: (() => void) | undefined;
	yield* Effect.addFinalizer(() =>
		Effect.promise(async () => {
			engine.lastView = screenView(engine);
			await act(() =>
				Promise.resolve().then(() => {
					unmount?.();
					window.dispatchEvent(new Event("pagehide"));
				}),
			);
			container.remove();
		}),
	);
	act(() => {
		unmount = mountBoard(container, () => session(environment));
	});
	return { container, environment, first, notes };
});
