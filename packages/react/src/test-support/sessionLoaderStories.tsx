import { Deferred, Effect } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { loaderSession, Unauthorized, Unavailable } from "./loaderSession.ts";
import { clickButton, type Screen, screenWarnings } from "./Screen.ts";
import { SessionLoaderApp } from "./SessionLoaderApp.tsx";
import { screenKit } from "./screenKit.ts";
import { settleScreen } from "./settleScreen.ts";

type Mode = "route" | "direct";
type Failure = "Unauthorized" | "Unavailable";

interface State {
	readonly session: ReturnType<typeof loaderSession>;
	view?: Rendered;
}

function current(state: State) {
	if (!state.view) {
		throw new Error("No session loader screen");
	}
	return state.view;
}

function click(state: State, screen: Screen, label: string) {
	return screen
		.act(`click ${label}`, () => clickButton(current(state).container, label))
		.pipe(Effect.andThen(settleScreen(current(state).container, () => state.session.busy(), screen.tell)));
}

function failLoad(state: State, screen: Screen, failure: Unauthorized | Unavailable) {
	return screen
		.act(`the private load fails as ${failure._tag}`, () => Effect.runSync(Deferred.fail(state.session.gate, failure)))
		.pipe(Effect.andThen(settleScreen(current(state).container, () => state.session.busy(), screen.tell)));
}

export const sessionLoaders = storyKit(
	screenKit(
		"session loader screen",
		(): State => ({ session: loaderSession() }),
		(state, screen) => ({
			alert: () => Effect.sync(() => current(state).container.querySelector("[role=alert]")?.textContent ?? "no alert"),
			applySession: () => click(state, screen, "Apply session"),
			failLoad: (failure: Failure) => failLoad(state, screen, failure === "Unauthorized" ? new Unauthorized() : new Unavailable()),
			rechecks: () => Effect.sync(() => [...state.session.recheckedSessions]),
			screenText: () => Effect.sync(() => current(state).container.textContent),
			signIn: () => click(state, screen, "Sign in"),
		}),
	),
);

function* openLoading({ screen, state }: { readonly screen: Screen; readonly state: State }, mode: Mode, failure: Failure) {
	const expected =
		mode === "route"
			? { onCaughtError: screenWarnings.expectCaughtError((error) => error instanceof (failure === "Unauthorized" ? Unauthorized : Unavailable)) }
			: undefined;
	state.view = yield* screen.open(<SessionLoaderApp mode={mode} session={state.session} />, expected);
	yield* screen.act("click Load private data", () => clickButton(current(state).container, "Load private data"));
}

export function privateLoadWaiting(mode: Mode, failure: Failure) {
	return sessionLoaders.trait("screen", `visitor's ${mode} load of private data waits on a server whose session ended`, (engine) =>
		openLoading(engine, mode, failure),
	);
}

export function unauthorizedLoad(mode: Mode) {
	return sessionLoaders.trait("screen", `visitor's ${mode} load of private data failed as Unauthorized`, function* (engine) {
		yield* openLoading(engine, mode, "Unauthorized");
		yield* failLoad(engine.state, engine.screen, new Unauthorized());
	});
}
