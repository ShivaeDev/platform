import { Deferred, Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type { ReactNode } from "react";
import { type MockInstance, vi } from "vitest";
import type { render } from "@shivaedev/effect-react/testing.ts";
import type { FleetItemsProjection } from "#browser/views/FleetItemsProjection.ts";
import { browserStorage } from "./browserStorage.ts";
import type { chrome } from "./chrome.ts";
import type { mountDocument } from "./documentRendering.ts";
import type { BoardFixtureOptions } from "./inMemoryBoard.ts";
import type { mountSession } from "./mountSession.ts";
import type { BoardTestApi, renderBoard } from "./react.tsx";
import type { renderRouter } from "./renderRouter.tsx";

export interface ScreenEngine {
	ageModified?: number;
	api?: BoardTestApi;
	boardScreen?: Awaited<ReturnType<typeof renderBoard>>;
	readonly cleanups: Array<() => Promise<void>>;
	container?: HTMLElement;
	documentFailed?: boolean;
	documentView?: Awaited<ReturnType<typeof mountDocument>>;
	files: Readonly<Record<string, string>>;
	fleet?: FleetItemsProjection;
	health?: boolean;
	heldRead?: { readonly url: string; readonly gate: Deferred.Deferred<void>; started: boolean };
	indexFailed?: boolean;
	indexGate?: Deferred.Deferred<void>;
	lastView?: ReturnType<typeof screenView>;
	motion?: {
		focus: MockInstance<HTMLElement["focus"]>;
		passage: MockInstance<HTMLElement["scrollIntoView"]>;
		scroll: MockInstance<Window["scrollTo"]>;
	};
	options?: BoardFixtureOptions | undefined;
	path: string;
	pendingNavigation?: Promise<void> | undefined;
	readingStatus?: string[];
	referenceMarkup?: HTMLElement;
	routed?: Awaited<ReturnType<typeof chrome>>;
	router?: Awaited<ReturnType<typeof renderRouter>>["router"];
	scrollPosition?: number;
	session?: Effect.Success<ReturnType<typeof mountSession>>;
	tell?: (line: string) => void;
	updatesPaused?: Atom.Writable<boolean>;
	view?: Awaited<ReturnType<typeof render>>;
}

export function* createScreen() {
	Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
	browserStorage();
	window.sessionStorage.clear();
	window.history.replaceState({}, "", "/");
	const attributes = [...document.documentElement.attributes].map(({ name, value }) => [name, value] as const);
	const engine: ScreenEngine = { cleanups: [], files: {}, path: "/" };
	yield* Effect.addFinalizer(() =>
		Effect.promise(async () => {
			if (engine.indexGate) {
				Effect.runSync(Deferred.succeed(engine.indexGate, undefined));
			}
			for (const close of engine.cleanups.reverse()) {
				await close();
			}
			window.dispatchEvent(new Event("pagehide"));
			vi.restoreAllMocks();
			vi.unstubAllGlobals();
			vi.useRealTimers();
			for (const attribute of [...document.documentElement.attributes]) {
				document.documentElement.removeAttribute(attribute.name);
			}
			for (const [name, value] of attributes) {
				document.documentElement.setAttribute(name, value);
			}
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
