import { Deferred, Effect } from "effect";
import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { Activity, act, type ReactNode, StrictMode } from "react";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { SessionBoundary } from "#client/sessionBoundary.ts";
import { Answer, Round } from "./lifecycleViews.tsx";
import type { Screen } from "./Screen.ts";
import { screenKit } from "./screenKit.ts";

function registryState(registry: AtomRegistry.AtomRegistry | undefined) {
	if (registry === undefined) {
		throw new Error("The session never rendered a registry");
	}
	return registry.getNodes().size > 0 ? "holds atoms" : "empty";
}

function boundary(registries: AtomRegistry.AtomRegistry[], session: string | undefined) {
	return (
		<SessionBoundary connect={() => undefined} identify={(id) => id} recheck={() => undefined} session={session}>
			{() => <Answer registries={registries} />}
		</SessionBoundary>
	);
}

function rendered(view: Rendered | undefined) {
	if (view === undefined) {
		throw new Error("The session screen is not open");
	}
	return view;
}

function show(view: Rendered | undefined, node: ReactNode) {
	return act(async () => {
		await rendered(view).render(node);
		await Promise.resolve();
	});
}

interface StrictState {
	readonly registries: AtomRegistry.AtomRegistry[];
	view?: Rendered;
}

export const strictSessions = storyKit(
	screenKit(
		"StrictMode session screen",
		(): StrictState => ({ registries: [] }),
		(state, screen) => ({
			registry: () => Effect.sync(() => registryState(state.registries[0])),
			shown: () => Effect.sync(() => rendered(state.view).container.textContent),
			signOut: () => screen.act("sign out", () => show(state.view, <StrictMode>{boundary(state.registries, undefined)}</StrictMode>)),
		}),
	),
);

export function strictSignedIn() {
	return strictSessions.trait("screen", "session s1 is signed in under StrictMode, which replays its effects", function* ({ screen, state }) {
		state.view = yield* screen.open();
		yield* screen.act("sign in as s1", () => show(state.view, <StrictMode>{boundary(state.registries, "s1")}</StrictMode>));
	});
}

interface ActivityState {
	readonly errors: unknown[];
	hoisted?: ReactNode;
	readonly registries: AtomRegistry.AtomRegistry[];
	view?: Rendered;
}

function showActivity(state: ActivityState, mode: "visible" | "hidden") {
	return async () => {
		try {
			await show(state.view, <Activity mode={mode}>{state.hoisted ?? boundary(state.registries, "s1")}</Activity>);
		} catch (error) {
			state.errors.push(error);
		}
	};
}

export const activitySessions = storyKit(
	screenKit(
		"Activity session screen",
		(): ActivityState => ({ errors: [], registries: [] }),
		(state, screen) => ({
			close: () => screen.act("close the session screen", () => rendered(state.view).unmount()),
			hideAndReveal: () =>
				screen
					.act("hide the session", showActivity(state, "hidden"))
					.pipe(Effect.andThen(screen.act("reveal the session", showActivity(state, "visible")))),
			registries: () => Effect.sync(() => state.registries.map(registryState)),
			registry: () => Effect.sync(() => registryState(state.registries.at(-1))),
			renderErrors: () => Effect.sync(() => state.errors.map(String)),
			shown: () => Effect.sync(() => rendered(state.view).container.textContent),
		}),
	),
);

export function activityShown(element: "hoisted" | "recreated") {
	const line =
		element === "hoisted"
			? "session s1 is shown inside Activity from one element kept across renders"
			: "session s1 is shown inside Activity from a new element on each render";
	return activitySessions.trait("screen", line, function* ({ screen, state }) {
		state.view = yield* screen.open();
		if (element === "hoisted") {
			state.hoisted = boundary(state.registries, "s1");
		}
		yield* screen.act("reveal the session", showActivity(state, "visible"));
	});
}

interface HiddenState {
	readonly built: number[];
	readonly finalized: Deferred.Deferred<void>;
	readonly resource: Atom.Atom<number>;
	readonly rounds: number[];
	view?: Rendered;
}

function showRound(state: HiddenState, mode: "visible" | "hidden", round: number) {
	return show(
		state.view,
		<Activity mode={mode}>
			<SessionBoundary connect={() => undefined} identify={(id) => id} recheck={() => undefined} session="s1">
				{() => <Round resource={state.resource} round={round} rounds={state.rounds} />}
			</SessionBoundary>
		</Activity>,
	);
}

function releasedResources(state: HiddenState, screen: Screen) {
	screen.tell("wait for the hidden renders' resources to be released");
	return Deferred.await(state.finalized).pipe(
		Effect.as("released"),
		Effect.timeoutOrElse({ duration: "3 seconds", orElse: () => Effect.succeed("still held") }),
	);
}

export const hiddenSessions = storyKit(
	screenKit(
		"hidden session screen",
		(): HiddenState => {
			const built: number[] = [];
			const finalized = Deferred.makeUnsafe<void>();
			let open = 0;
			const resource = Atom.keepAlive(
				Atom.make((get) => {
					built.push(built.length + 1);
					open += 1;
					get.addFinalizer(() => {
						open -= 1;
						if (open === 0) {
							Deferred.doneUnsafe(finalized, Effect.void);
						}
					});
					return 1;
				}),
			);
			return { built, finalized, resource, rounds: [] };
		},
		(state, screen) => ({
			builtResources: () => Effect.sync(() => [...state.built]),
			close: () => screen.act("close the session screen", () => rendered(state.view).unmount()),
			releasedResources: () => releasedResources(state, screen),
			renderedRounds: () => Effect.sync(() => [...state.rounds]),
		}),
	),
);

export function rerenderedWhileHidden() {
	return hiddenSessions.trait("screen", "session s1 rendered round 1, was hidden and rendered round 2 while hidden", function* ({ screen, state }) {
		state.view = yield* screen.open();
		yield* screen.act("reveal round 1", () => showRound(state, "visible", 1));
		yield* screen.act("hide round 1", () => showRound(state, "hidden", 1));
		yield* screen.act("render round 2 while hidden", () => showRound(state, "hidden", 2));
	});
}

interface Rotating {
	readonly credential: number;
	readonly id: string;
	readonly token: string;
}

interface RotationState {
	readonly connected: string[];
	identify?: (session: Rotating) => string;
	view?: Rendered;
}

function showRotating(state: RotationState, session: Rotating) {
	const identify = state.identify;
	if (identify === undefined) {
		throw new Error("No identify was chosen");
	}
	return show(
		state.view,
		<SessionBoundary
			connect={(current) => {
				state.connected.push(current.token);
				return current.token;
			}}
			identify={identify}
			recheck={() => undefined}
			session={session}
		>
			{(token) => <output>{token}</output>}
		</SessionBoundary>,
	);
}

export const identifyBy = {
	"credential": (session: Rotating) => `${session.id}:${session.credential}`,
	"session id": (session: Rotating) => session.id,
};

export const rotations = storyKit(
	screenKit(
		"rotating session screen",
		(): RotationState => ({ connected: [] }),
		(state, screen) => ({
			connections: () => Effect.sync(() => [...state.connected]),
			rotate: () =>
				screen.act("session a1 rotates to credential 2 with token t2", () => showRotating(state, { credential: 2, id: "a1", token: "t2" })),
			shownToken: () => Effect.sync(() => rendered(state.view).container.textContent),
		}),
	),
);

export function signedInWithCredential(identifiedBy: keyof typeof identifyBy) {
	return rotations.trait(
		"screen",
		`session a1 is signed in with credential 1 and token t1, identified by ${identifiedBy}`,
		function* ({ screen, state }) {
			state.identify = identifyBy[identifiedBy];
			state.view = yield* screen.open();
			yield* screen.act("sign in with token t1", () => showRotating(state, { credential: 1, id: "a1", token: "t1" }));
		},
	);
}
