import { Deferred, Effect } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type { ReactNode } from "react";
import { type MockInstance, vi } from "vitest";
import type { render } from "@shivaedev/effect-react/client/testing.ts";
import { loadMarkdownRenderers } from "#client/react/markdownLoader.ts";
import type { FileSystemWrapper } from "./board.ts";
import { browserStorage } from "./browserStorage.ts";
import type { chrome } from "./chrome.ts";
import type { mountDocument } from "./documentRendering.ts";
import type { BoardFixtureOptions } from "./inMemoryBoard.ts";
import type { mountSession } from "./mountSession.ts";
import type { BoardTestApi, renderBoard } from "./react.tsx";
import type { renderRouter } from "./renderRouter.tsx";
import type { DiagramDrawing } from "./screenDiagrams.ts";
import type { SessionTransport } from "./sessionTransport.ts";

export interface ScreenEngine {
	api?: BoardTestApi;
	boardScreen?: Awaited<ReturnType<typeof renderBoard>>;
	readonly cleanups: Array<() => Promise<void>>;
	container?: HTMLElement;
	documentFailed?: boolean;
	documentReads: string[];
	documentView?: Awaited<ReturnType<typeof mountDocument>>;
	drawings?: DiagramDrawing[];
	files: Readonly<Record<string, string>>;
	fleet?: BoardFixtureOptions["fleet"];
	health?: boolean;
	heldRead?: { readonly url: string; readonly gate: Deferred.Deferred<void>; started: boolean };
	heldRefresh?: { readonly url: string; readonly gate: Deferred.Deferred<void>; readonly failed: boolean; started: boolean };
	indexFailed?: boolean;
	indexGate?: Deferred.Deferred<void>;
	indexReads: number;
	lastView?: ReturnType<typeof screenView>;
	media?: Map<string, MediaQueryList>;
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
	sessionFleetPort?: number;
	sessionTransport?: SessionTransport;
	sessionWrap?: FileSystemWrapper | undefined;
	startupGate?: Deferred.Deferred<void>;
	tell?: (line: string) => void;
	time?: { readonly at: number; readonly view: (at: number) => ReactNode };
	updatesPaused?: Atom.Writable<boolean>;
	view?: Awaited<ReturnType<typeof render>>;
}

export function* createScreen() {
	Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
	browserStorage();
	window.sessionStorage.clear();
	window.history.replaceState({}, "", "/");
	// Screens render inside synchronous act(), which rejects a suspending first load; the served-bundle stories cover the lazy load itself.
	yield* Effect.promise(loadMarkdownRenderers);
	const attributes = [...document.documentElement.attributes].map(({ name, value }) => [name, value] as const);
	const engine: ScreenEngine = { cleanups: [], documentReads: [], files: {}, indexReads: 0, path: "/" };
	yield* Effect.addFinalizer(() =>
		Effect.promise(async () => {
			for (const close of engine.cleanups.reverse()) {
				await close();
			}
			releaseScreenReads(engine);
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

function releaseScreenReads(engine: ScreenEngine) {
	for (const gate of [engine.indexGate, engine.startupGate, engine.heldRefresh?.gate]) {
		if (gate) {
			Effect.runSync(Deferred.succeed(gate, undefined));
		}
	}
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
		storage: screenStorage(),
		text: root.textContent,
	};
}

function screenStorage() {
	try {
		return Object.fromEntries(Object.keys(window.localStorage).map((key) => [key, window.localStorage.getItem(key)]));
	} catch {
		return undefined;
	}
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
