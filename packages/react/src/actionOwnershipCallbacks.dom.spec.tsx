import { expect } from "vitest";
import { launchPending, ownership } from "#test/action-ownership/story.tsx";

ownership.it(
	"a replaced Launch cannot present through Resume's completion callback, while Resume presents its own refusal",
	[launchPending("runtime")],
	function* ({ dispatch, feedback, reject, switchCommand }) {
		yield* switchCommand("Resume");

		yield* reject("Launch", "Launch was refused");

		expect(yield* feedback()).toBe("");

		yield* dispatch();
		yield* reject("Resume", "Resume was refused");

		expect(yield* feedback()).toBe("Resume: Resume was refused");
	},
);
