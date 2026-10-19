import { Deferred, Effect } from "effect";
import { vi } from "vitest";
import type { FleetHealth } from "#diagnostics/health.ts";
import { diagnosticsDaemon } from "./diagnosticsDaemon.ts";
import { fixtureSnapshot } from "./fixtureSnapshot.ts";
import { screenStory } from "./screenStory.ts";

export function intervalClock() {
	return screenStory.trait("workspace", "polling intervals follow the story clock", () => {
		vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
	});
}

export function blockedStorage() {
	return screenStory.trait("workspace", "browser storage is blocked", function* () {
		function blocked(): never {
			throw new Error("Storage blocked");
		}
		vi.stubGlobal("localStorage", { getItem: blocked, setItem: blocked });
		const spy = vi.spyOn(window, "localStorage", "get").mockImplementation(blocked);
		yield* Effect.addFinalizer(() => Effect.sync(() => spy.mockRestore()));
	});
}

export function screenWorkspace(name: string) {
	return screenStory.trait("workspace", `the browser opens workspace ${name}`, () => {
		document.documentElement.dataset.workspace = name;
	});
}

export function screenMedia(matches: readonly string[], touchPoints = 0) {
	return screenStory.trait("workspace", `the browser matches ${matches.join(", ")} with ${touchPoints} touch points`, (engine) => {
		const match = window.matchMedia.bind(window);
		const mediaQueries = new Map<string, MediaQueryList>();
		engine.media = mediaQueries;
		vi.stubGlobal("navigator", Object.create(window.navigator, { maxTouchPoints: { value: touchPoints } }));
		vi.stubGlobal("matchMedia", (query: string) => {
			const previous = mediaQueries.get(query);
			if (previous) {
				return previous;
			}
			const media = match(query);
			Object.defineProperty(media, "matches", { configurable: true, value: matches.includes(query) });
			mediaQueries.set(query, media);
			return media;
		});
	});
}

export function screenChartLayout(width = 640) {
	return screenStory.trait("workspace", `the browser lays charts out ${width} pixels wide at their styled height`, () => {
		const measure = HTMLElement.prototype.getBoundingClientRect;
		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
			return this.classList.contains("recharts-responsive-container")
				? new DOMRect(0, 0, width, Number.parseFloat(this.parentElement?.style.height ?? "") || 0)
				: measure.call(this);
		});
	});
}

export function screenHistory(state: unknown, path = "/") {
	return screenStory.trait("workspace", `the browser remembers history at ${path}`, () => window.history.replaceState(state, "", path));
}

export function screenSession(values: Readonly<Record<string, string>>) {
	return screenStory.trait("workspace", "the browser remembers this session", () => {
		for (const [key, value] of Object.entries(values)) {
			window.sessionStorage.setItem(key, value);
		}
	});
}

export function fallibleDocument() {
	return screenStory.trait("workspace", "document reads can become unavailable", (engine) => {
		engine.documentFailed = false;
	});
}

export function unavailableWorkspace() {
	return screenStory.trait("workspace", "the workspace index is temporarily unavailable", (engine) => {
		engine.indexFailed = true;
		engine.health = true;
	});
}

export function unreadableHome() {
	return screenStory.trait("workspace", "the home file cannot be read", (engine) => {
		const home = engine.options?.home;
		if (home === undefined) {
			throw new Error("The workspace has no home file");
		}
		engine.options = {
			...engine.options,
			home,
			index: fixtureSnapshot(engine.files, home).pipe(Effect.map((snapshot) => ({ ...snapshot, unavailable: [home] }))),
		};
	});
}

export function fleetHealth(value: FleetHealth) {
	return screenStory.trait("workspace", "Fleet publishes its health", (engine) => {
		engine.options = { home: Object.keys(engine.files)[0], ...engine.options, fleetHealth: value };
	});
}

export function stoppedFleet() {
	return screenStory.trait("workspace", "the Fleet daemon has stopped", function* (engine) {
		const missing = { cause: "Not configured", observedAt: 0, state: "not-configured" } as const;
		const daemon = yield* diagnosticsDaemon(() => ({ codex: missing, fleet: missing, github: missing }));
		yield* daemon.stop();
		engine.options = { ...engine.options, fleetPort: daemon.port };
	});
}

export function pendingFleet() {
	return screenStory.trait("workspace", "the Fleet daemon waits before answering", function* (engine) {
		const missing = { cause: "Not configured", observedAt: 0, state: "not-configured" } as const;
		const daemon = yield* diagnosticsDaemon(() => ({ codex: missing, fleet: missing, github: missing }), 0, Effect.never);
		engine.options = { ...engine.options, fleetPort: daemon.port };
	});
}

export function heldWorkspace() {
	return screenStory.trait("workspace", "workspace indexing waits", (engine) => {
		engine.indexGate = Deferred.makeUnsafe<void>();
	});
}

export function startingBoard() {
	return screenStory.trait("workspace", "the Board RPC services wait before starting", function* (engine) {
		const gate = yield* Deferred.make<void>();
		engine.startupGate = gate;
		engine.options = { ...engine.options, beforeStart: Deferred.await(gate) };
	});
}

export function deniedClipboard() {
	return screenStory.trait("workspace", "the clipboard is unavailable", () => {
		vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("Denied"));
	});
}
