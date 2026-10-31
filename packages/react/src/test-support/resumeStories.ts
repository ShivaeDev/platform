import { Effect } from "effect";
import { createElement } from "react";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { ResumeLiveScreen } from "./ResumeLiveScreen.tsx";
import { resumeLiveClient } from "./resumeLiveClient.ts";
import type { Screen } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";
import { settleScreen } from "./settleScreen.ts";
import { syntheticNative } from "./syntheticNative.ts";

type Source = "native" | "browser";

interface State {
	live?: ReturnType<typeof resumeLiveClient>;
	readonly native: ReturnType<typeof syntheticNative>;
	root?: Rendered;
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
		(): State => ({ native: syntheticNative() }),
		(state, screen) => ({
			...resumeVerbs(state, screen),
			close: () => screen.act("close the resume screen", () => root(state).unmount()),
			liveReconnect: (source: Source) =>
				screen
					.act(`the ${source} app reconnects`, () => (source === "native" ? state.native.resume() : window.dispatchEvent(new Event("online"))))
					.pipe(Effect.andThen(settleLive(state, screen))),
			liveResume: (source: Source) =>
				screen
					.act(`the ${source} app resumes`, () => (source === "native" ? state.native.resume() : window.dispatchEvent(new Event("visibilitychange"))))
					.pipe(Effect.andThen(settleLive(state, screen))),
			nativeSubscription: () => Effect.sync(() => (state.native.listeners.size === 0 ? "released" : "subscribed")),
			shown: () => Effect.sync(() => root(state).container.textContent),
			subscriptions: () => Effect.sync(() => live(state).subscriptionStates()),
		}),
	),
);

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
