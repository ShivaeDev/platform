import { type Deferred, Effect } from "effect";
import type { ReactNode } from "react";
import { vi } from "vitest";
import type { render } from "@shivaedev/effect-react/testing.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { browserStorage } from "./browserStorage.ts";
import type { BoardFixtureOptions } from "./inMemoryBoard.ts";
import type { renderBoard } from "./react.tsx";
import type { renderRouter } from "./renderRouter.tsx";

export interface ScreenEngine {
	boardScreen?: Awaited<ReturnType<typeof renderBoard>>;
	readonly cleanups: Array<() => Promise<void>>;
	container?: HTMLElement;
	files: Readonly<Record<string, string>>;
	fleet?: FleetItemsProjection;
	heldRead?: { readonly url: string; readonly gate: Deferred.Deferred<void>; started: boolean };
	lastView?: ReturnType<typeof screenView>;
	options?: BoardFixtureOptions | undefined;
	path: string;
	routed?: Awaited<ReturnType<typeof import("./chrome.ts").chrome>>;
	router?: Awaited<ReturnType<typeof renderRouter>>["router"];
	tell?: (line: string) => void;
	view?: Awaited<ReturnType<typeof render>>;
}

export function* createScreen() {
	Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
	browserStorage();
	const engine: ScreenEngine = { cleanups: [], files: {}, path: "/" };
	yield* Effect.addFinalizer(() =>
		Effect.promise(async () => {
			for (const close of engine.cleanups.reverse()) {
				await close();
			}
			vi.unstubAllGlobals();
		}),
	);
	return engine;
}

export function screenView(engine: ScreenEngine) {
	const root = engine.container ?? engine.view?.container ?? document.body;
	return {
		controls: [...root.querySelectorAll("input, textarea, select")].map((element) => ({
			name: element.getAttribute("name") ?? element.id,
			value:
				element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement ? element.value : null,
		})),
		html: root.innerHTML,
		location: engine.router?.state.location.href ?? window.location.href,
		storage: Object.fromEntries(Object.keys(window.localStorage).map((key) => [key, window.localStorage.getItem(key)])),
		text: root.textContent,
	};
}

export function trackScreen<T extends Awaited<ReturnType<typeof render>>>(engine: ScreenEngine, view: T, tell: (line: string) => void): T {
	let closed = false;
	const close = view.unmount;
	async function unmount() {
		if (closed) {
			return;
		}
		if (engine.view === tracked) {
			engine.lastView = screenView(engine);
		}
		tell("the reader closes the screen");
		closed = true;
		await close();
	}
	const refresh = view.render;
	async function rerender(next: ReactNode) {
		tell("the screen receives refreshed data");
		await refresh(next);
	}
	const tracked = { ...view, render: rerender, unmount };
	engine.view = tracked;
	delete engine.container;
	engine.cleanups.push(unmount);
	return tracked;
}
