import { Clock, Effect } from "effect";
import { TestClock } from "effect/testing";
import { type State, settle } from "#test/notices/state.ts";
import { interruptsUndo } from "#test/notices/verbs.tsx";
import type { Screen } from "#test/Screen.ts";

export function advance(state: State, screen: Screen, millis: number) {
	const clock = state.clock;
	if (clock === undefined) {
		throw new Error("The notice host has no clock");
	}
	return screen.act(`the host's clock advances ${millis} ms`, () =>
		Effect.runPromise(TestClock.adjust(millis).pipe(Effect.provideService(Clock.Clock, clock))),
	);
}

export function noticeClockVerbs(state: State, screen: Screen) {
	return {
		hostClockAdvances: (millis: number) => advance(state, screen, millis).pipe(Effect.andThen(settle(state, screen))),
		noticeExpires: (message: string, millis: number) => {
			screen.tell(`${message} reaches its expiry`);
			return interruptsUndo(state, screen, advance(state, screen, millis));
		},
	};
}
