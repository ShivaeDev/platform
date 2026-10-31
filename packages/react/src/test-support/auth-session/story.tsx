import { Effect } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { Rendered } from "@shivaedev/test-story/client/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { clickButton } from "#test/Screen.ts";
import { screenKit } from "#test/screenKit.ts";
import { sessionClient } from "./client.ts";
import { type Frame, SessionView } from "./view.tsx";

interface State {
	readonly client: ReturnType<typeof sessionClient>;
	readonly frames: Frame[];
	view?: Rendered;
}
function view(state: State) {
	if (!state.view) {
		throw new Error("No session screen");
	}
	return state.view;
}
export const sessions = storyKit(
	screenKit(
		"auth session",
		(): State => ({ client: sessionClient(), frames: [] }),
		(state, screen) => ({
			answer: () => screen.act("the session read answers from stored user data", state.client.answer),
			completedFrames: () => state.frames.filter((frame) => frame.completed),
			press: (label: "Rename" | "Verify" | "Refresh") => screen.act(`press ${label}`, () => clickButton(view(state).container, label)),
			refuse: () => screen.act("the session read is refused", state.client.refuse),
			reject: () => screen.act("the session connection rejects", state.client.reject),
			shown: () => ({
				busy: view(state).container.querySelector("section")?.getAttribute("aria-busy"),
				text: view(state).container.textContent,
			}),
			signOut: () => screen.act("the auth owner clears its session", state.client.signOut),
			waitForMutation: () =>
				screen.act("await the mutation's outcome", () =>
					Effect.runPromise(AtomRegistry.getResult(view(state).registry, state.client.mutation, { suspendOnWaiting: true }).pipe(Effect.result)),
				),
		}),
	),
);
export function sessionLoading() {
	return sessions.trait("screen", "the session read is pending", function* ({ screen, state }) {
		state.view = yield* screen.open(<SessionView client={state.client} frames={state.frames} />);
	});
}
export function sessionReady() {
	return sessions.trait("screen", "Alice's session is on screen", function* ({ screen, state }) {
		state.view = yield* screen.open(<SessionView client={state.client} frames={state.frames} />);
		yield* screen.act("the initial session read answers", state.client.answer);
	});
}
