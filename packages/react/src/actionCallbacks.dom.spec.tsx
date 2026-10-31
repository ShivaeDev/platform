import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { commands, firstHeld } from "#test/command-completion/story.tsx";

for (const outcome of ["success", "failure"] as const) {
	commands.it(
		`${outcome} callbacks and notices read props and query data committed while the action was pending`,
		[firstHeld()],
		function* ({ answerList, callbackShown, complete, listShown, publishedNotices, refreshList, reject, switchCallback }) {
			yield* outcomes([
				["callback presentation", () => callbackShown(), ""],
				["notices", () => publishedNotices(), []],
				["shown list", () => listShown(), "initial"],
			]);

			yield* switchCallback("current");
			yield* refreshList();
			yield* answerList("fresh rows");

			expect(yield* listShown()).toBe("fresh rows");

			if (outcome === "success") {
				yield* complete("first", "A");
			} else {
				yield* reject("first", "Rejected");
			}

			const feedback = outcome === "success" ? "current: first -> A / fresh rows" : "current: first rejected: Rejected / fresh rows";
			yield* outcomes([
				["callback presentation", () => callbackShown(), feedback],
				["notices", () => publishedNotices(), [feedback]],
			]);
		},
	);
}
