import { Effect } from "effect";
import { createElement } from "react";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { ResumeLiveScreen } from "#test/ResumeLiveScreen.tsx";
import { resumeLiveClient } from "#test/resumeLiveClient.ts";
import type { Screen } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { settleScreen } from "#test/settleScreen.ts";
import { syntheticNative } from "#test/syntheticNative.ts";

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

function output(state: State) {
	return root(state).container.querySelector("output");
}

function resyncShown(state: State) {
	return output(state)?.getAttribute("data-needs-resync") === "true";
}

function liveSettled(state: State) {
	return (
		output(state)?.getAttribute("data-live") === "live"
		&& output(state)?.getAttribute("data-pending") === "false"
		&& !resyncShown(state)
		&& live(state).active() === 2
	);
}

function settleLive(state: State, screen: Screen) {
	return settleScreen(root(state).container, () => !liveSettled(state), screen.tell);
}

function signal(state: State, source: Source, browserEvent: "online" | "visibilitychange") {
	return () => (source === "native" ? state.native.resume() : window.dispatchEvent(new Event(browserEvent)));
}

// The resync is held until the screen reports it, so the settle after release cannot read a screen that has not started resyncing yet.
function heldResync(state: State, screen: Screen, line: string, resume: () => void) {
	return Effect.sync(() => live(state).holdResync()).pipe(
		Effect.andThen(screen.act(line, resume)),
		Effect.andThen(settleScreen(root(state).container, () => !resyncShown(state), screen.tell)),
	);
}

function releasedResync(state: State, screen: Screen) {
	return screen.act("the resync reaches the client", () => live(state).releaseResync()).pipe(Effect.andThen(settleLive(state, screen)));
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
				heldResync(state, screen, `the ${source} app reconnects`, signal(state, source, "online")).pipe(
					Effect.andThen(releasedResync(state, screen)),
				),
			liveResume: (source: Source) =>
				heldResync(state, screen, `the ${source} app resumes`, signal(state, source, "visibilitychange")).pipe(
					Effect.andThen(releasedResync(state, screen)),
				),
			nativeSubscription: () => Effect.sync(() => (state.native.listeners.size === 0 ? "released" : "subscribed")),
			releaseResync: () => releasedResync(state, screen),
			reported: () =>
				Effect.sync(() => ({
					needsResync: output(state)?.getAttribute("data-needs-resync"),
					pending: output(state)?.getAttribute("data-pending"),
				})),
			resumeHoldingResync: (source: Source) => heldResync(state, screen, `the ${source} app resumes`, signal(state, source, "visibilitychange")),
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
