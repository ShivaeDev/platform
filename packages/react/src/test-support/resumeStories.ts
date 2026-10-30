import { useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { createElement } from "react";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { resumeSignal } from "#resumeSignal.ts";
import { countWords, timesWords } from "./outcomeWords.ts";
import { ResumeLiveScreen } from "./ResumeLiveScreen.tsx";
import { resumeLiveClient } from "./resumeLiveClient.ts";
import { counted, syntheticNative, syntheticWindow } from "./resumeSources.ts";
import type { Screen } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";
import { settleScreen } from "./settleScreen.ts";

type Source = "native" | "browser";

interface State {
	readonly browser: ReturnType<typeof syntheticWindow>;
	readonly fresh: ReturnType<typeof counted>;
	live?: ReturnType<typeof resumeLiveClient>;
	readonly native: ReturnType<typeof syntheticNative>;
	root?: Rendered;
	readonly stale: ReturnType<typeof counted>;
}

function root(state: State) {
	if (!state.root) {
		throw new Error("No resume screen");
	}
	return state.root;
}

function live(state: State) {
	if (!state.live) {
		throw new Error("No live notes client");
	}
	return state.live;
}

function liveSettled(state: State) {
	const output = root(state).container.querySelector("output");
	return output?.getAttribute("data-live") === "live" && output.getAttribute("data-pending") === "false" && live(state).active() === 2;
}

function settleLive(state: State, screen: Screen) {
	return settleScreen(root(state).container, () => !liveSettled(state), screen.tell);
}

function resumeVerbs(state: State, screen: Screen) {
	return {
		disconnect: () =>
			screen
				.act("the live stream is interrupted", () => live(state).disconnect())
				.pipe(Effect.andThen(settleScreen(root(state).container, () => live(state).active() > 0, screen.tell))),
		renameWhileAway: (id: number, title: string) =>
			Effect.sync(() => {
				screen.tell(`another client renames note ${id} to ${title}`);
				live(state).rename(id, title);
			}),
	};
}

export const resumes = storyKit(
	screenKit(
		"resume screen",
		(): State => ({ browser: syntheticWindow(), fresh: counted(), native: syntheticNative(), stale: counted() }),
		(state, screen) => ({
			...resumeVerbs(state, screen),
			browserReconnects: (visibility: "visible" | "hidden" = "visible") =>
				screen.act(`the browser reconnects while the page is ${visibility}`, () => state.browser.fire("online", visibility)),
			close: () => screen.act("close the resume screen", () => root(state).unmount()),
			listeners: () => Effect.sync(() => ({ browser: state.browser.listeners.size, native: state.native.listeners.size })),
			liveReconnect: (source: Source) =>
				screen
					.act(`the ${source} app reconnects`, () => (source === "native" ? state.native.resume() : window.dispatchEvent(new Event("online"))))
					.pipe(Effect.andThen(settleLive(state, screen))),
			liveResume: (source: Source) =>
				screen
					.act(`the ${source} app resumes`, () => (source === "native" ? state.native.resume() : window.dispatchEvent(new Event("visibilitychange"))))
					.pipe(Effect.andThen(settleLive(state, screen))),
			loads: () => Effect.sync(() => timesWords(state.fresh.reads())),
			nativeResume: () => screen.act("the native app resumes", () => state.native.resume()),
			openStreams: () => Effect.sync(() => countWords(live(state).active())),
			pageBecomes: (visibility: "visible" | "hidden") =>
				screen.act(`the page becomes ${visibility}`, () => state.browser.fire("visibilitychange", visibility)),
			shown: () => Effect.sync(() => root(state).container.textContent),
			staleLoads: () => Effect.sync(() => ({ fresh: state.fresh.reads(), stale: state.stale.reads() })),
			subscriptions: () => Effect.sync(() => live(state).subscriptionCount()),
			windowReconnects: () => screen.act("the real browser window reconnects", () => window.dispatchEvent(new Event("online"))),
		}),
	),
);

function Values({ atoms }: { readonly atoms: readonly Atom.Atom<unknown>[] }) {
	return createElement("output", null, ...atoms.map((atom, index) => createElement(Value, { atom, key: index })));
}

function Value({ atom }: { readonly atom: Atom.Atom<unknown> }) {
	return createElement("span", null, String(useAtomValue(atom)));
}

export function refreshOnResumeShown() {
	return resumes.trait("screen", "a query that refreshes on browser and native resume, loaded once", function* ({ screen, state }) {
		const signal = resumeSignal({ native: state.native.source, window: state.browser.window });
		state.root = yield* screen.open(createElement(Values, { atoms: [Atom.makeRefreshOnSignal(signal)(state.fresh.atom)] }));
	});
}

export function staleWhileRevalidateShown() {
	return resumes.trait(
		"screen",
		"a fresh and a stale stale-while-revalidate query on native resume, each loaded once",
		function* ({ screen, state }) {
			const signal = resumeSignal({ native: state.native.source });
			const atoms = [
				Atom.swr(state.fresh.atom, { focusSignal: signal, revalidateOnFocus: true, staleTime: "1 hour" }),
				Atom.swr(state.stale.atom, { focusSignal: signal, revalidateOnFocus: true, revalidateOnMount: false, staleTime: "0 millis" }),
			];
			state.root = yield* screen.open(createElement(Values, { atoms }));
		},
	);
}

export function windowSignalShown() {
	return resumes.trait("screen", "a resume signal on the real browser window", function* ({ screen, state }) {
		state.root = yield* screen.open(createElement(Values, { atoms: [resumeSignal({ window })] }));
	});
}

function* openLiveNotes({ screen, state }: { readonly screen: Screen; readonly state: State }, source: Source) {
	const client = resumeLiveClient(source === "native" ? state.native.source : undefined);
	state.live = client;
	state.root = yield* screen.open(createElement(ResumeLiveScreen, { client }));
	yield* settleLive(state, screen);
}

export function liveNotesShown(source: Source) {
	return resumes.trait("screen", `live notes One and Two with ${source} resume`, (engine) => openLiveNotes(engine, source));
}

export function liveNotesRenamedWhileAway(source: Source) {
	return resumes.trait("screen", `live notes One and Two with ${source} resume, both renamed while the app was away`, function* (engine) {
		yield* openLiveNotes(engine, source);
		const { renameWhileAway } = resumeVerbs(engine.state, engine.screen);
		yield* renameWhileAway(1, "Changed while away");
		yield* renameWhileAway(2, "Also changed while away");
	});
}

export function liveStreamInterrupted(source: Source) {
	return resumes.trait(
		"screen",
		`live notes One and Two with ${source} resume whose stream was interrupted before note 1 was renamed`,
		function* (engine) {
			yield* openLiveNotes(engine, source);
			const { disconnect, renameWhileAway } = resumeVerbs(engine.state, engine.screen);
			yield* disconnect();
			yield* renameWhileAway(1, "Changed while disconnected");
		},
	);
}
