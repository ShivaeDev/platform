import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { host } from "#test/hostStory.ts";

host.it("preserves argument and multiline stdin messages and refuses empty input", [], function* (daemon) {
	expect(yield* daemon.continuationMessage("Fix the checks", [])).toBe("Fix the checks");
	expect(yield* daemon.continuationMessage(undefined, ["Fix the checks.\n", "Keep the PR.\n"])).toBe("Fix the checks.\nKeep the PR.\n");
	for (const message of [undefined, " \n"]) {
		expect(yield* daemon.continuationMessage(message, []).pipe(Effect.flip)).toMatchObject({ _tag: "BadRequest" });
	}
});
