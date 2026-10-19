import { Cause, Data, Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { resultSession } from "./resultSession.ts";
import { screenKit } from "./screenKit.ts";

class Unauthorized extends Data.TaggedError("Unauthorized")<{ readonly message: string }> {}
interface State {
	cause?: Cause.Cause<never> | undefined;
	denied: Unauthorized;
	fail: boolean;
	view?: Awaited<ReturnType<typeof resultSession<unknown, unknown>>>;
}
function current(state: State) {
	if (!state.view) {
		throw new Error("No result session screen");
	}
	return state.view;
}
export const results = storyKit(
	screenKit(
		"result session screen",
		(): State => ({ denied: new Unauthorized({ message: "Session expired" }), fail: false }),
		(state, screen) => ({
			execute: () => screen.act("execute the result hook", () => current(state).execute()),
			rejectNext: () => {
				state.fail = true;
				screen.tell("the session's next request is Unauthorized");
			},
			rerender: () => screen.act("rerender the same session", () => current(state).rerender()),
			result: () => ({ ...current(state), denied: state.denied, expectedCause: state.cause }),
		}),
	),
);
export function resultProbe(kind: "query" | "action", mode: "undefined" | "defect" | "interruption" | "unauthorized") {
	return results.trait("screen", `a ${kind} session probe with ${mode} results`, function* ({ screen, state }) {
		const view = yield* screen.open();
		if (mode === "defect") {
			state.cause = Cause.die({ _tag: "Unauthorized" });
		}
		if (mode === "interruption") {
			state.cause = Cause.interrupt();
		}
		state.view = yield* Effect.promise(() =>
			resultSession(view, kind, () => {
				if (state.cause) {
					return Effect.failCause(state.cause);
				}
				if (mode === "unauthorized") {
					return state.fail ? Effect.fail(state.denied) : Effect.succeed("Saved order");
				}
				return Effect.succeed(undefined);
			}),
		);
	});
}
