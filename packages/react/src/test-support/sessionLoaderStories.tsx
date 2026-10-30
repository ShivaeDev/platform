import { Deferred, Effect } from "effect";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { loaderSession, type Unauthorized, type Unavailable } from "./loaderSession.ts";
import { clickButton } from "./Screen.ts";
import { SessionLoaderApp } from "./SessionLoaderApp.tsx";
import { screenKit } from "./screenKit.ts";

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
export const sessionLoaders = storyKit(
	screenKit(
		"session loader screen",
		(): State => ({ session: loaderSession() }),
		(state, screen) => ({
			applySession: () => screen.act("apply the auth owner's session verdict", () => clickButton(current(state).container, "Apply session")),
			fail: (error: Unauthorized | Unavailable) =>
				screen.act(`the load fails with ${error._tag}`, () => Effect.runSync(Deferred.fail(state.session.gate, error))),
			load: () => screen.act("load private data", () => clickButton(current(state).container, "Load private data")),
			signIn: () => screen.act("follow the sign-in redirect", () => clickButton(current(state).container, "Sign in")),
			view: () => ({ ...state.session, root: current(state) }),
		}),
	),
);
export function expiredLoaderSession(mode: "route" | "direct") {
	return sessionLoaders.trait("screen", `a signed-in ${mode} whose server session ended`, function* ({ state, screen }) {
		state.view = yield* screen.open(<SessionLoaderApp mode={mode} session={state.session} />);
	});
}
