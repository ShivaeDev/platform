import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { host } from "#test/hostStory.ts";
import { refusal } from "#test/refusal.ts";

host.it("preserves argument and multiline stdin messages and refuses empty input", [], function* (daemon) {
	yield* outcomes([
		["continuation message Fix the checks", () => daemon.continuationMessage("Fix the checks", []), "Fix the checks"],
		["continuation message", () => daemon.continuationMessage(undefined, ["Fix the checks.\n", "Keep the PR.\n"]), "Fix the checks.\nKeep the PR.\n"],
	]);
	for (const message of [undefined, " \n"]) {
		expect(yield* refusal(daemon.continuationMessage(message, []))).toMatch(/^bad request: /u);
	}
});
