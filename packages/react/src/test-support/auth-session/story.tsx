import { Clock, type Duration, Effect, Layer } from "effect";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { TestClock } from "effect/testing";
import type { Rendered } from "@shivaedev/test-story/client/adapters/react.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { sessionClient } from "#test/auth-session/client.ts";
import { type Frame, SessionView } from "#test/auth-session/view.tsx";
import { screenKit } from "#test/screenKit.ts";

interface State {
	readonly client: ReturnType<typeof sessionClient>;
	readonly clock: Clock.Clock;
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
		(clock): State => ({ client: sessionClient(Atom.runtime(Layer.succeed(Clock.Clock, clock))), clock, frames: [] }),
		(state, screen) => ({
			answer: () => screen.act("the session read answers from stored user data", state.client.answer),
			completedFrames: () => state.frames.filter((frame) => frame.completed),
			malformPermissions: () => screen.act("the session answers with malformed permission grants", state.client.malformPermissions),
			online: () => screen.act("the browser emits online", () => window.dispatchEvent(new Event("online"))),
			passes: (interval: Duration.Input) =>
				screen.act(`${interval} pass`, () => Effect.runPromise(TestClock.adjust(interval).pipe(Effect.provideService(Clock.Clock, state.clock)))),
			press: (label: "Rename" | "Verify" | "Refresh") => screen.driver(view(state).container).click({ name: label, role: "button" }),
			refuse: () => screen.act("the session read is refused", state.client.refuse),
			reject: () => screen.act("the session connection rejects", state.client.reject),
			sessionRequests: () => Effect.sync(state.client.reads),
			shown: () => ({
				busy: view(state).container.querySelector("section")?.getAttribute("aria-busy"),
				grants: view(state).container.querySelector("section")?.getAttribute("data-grants"),
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
