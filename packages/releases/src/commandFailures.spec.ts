import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { withoutGit } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

for (const argument of ["--unknown", "unexpected"]) {
	workspace.it(`plan rejects ${argument} with usage text`, [], function* ({ invoke }) {
		const answer = yield* invoke(["plan", argument]);
		expect(answer.exitCode).toBe(1);
		expect(answer.stderr).toContain(argument);
		expect(answer.stdout).toContain("USAGE");
		expect(answer.stdout).toContain("releases plan");
	});
}

workspace.it("check reports a git execution failure instead of an unresolved base or a clean result", [withoutGit], function* ({ check }) {
	const answer = yield* check();
	expect(answer).toEqual(expect.stringContaining("refused: git rev-parse"));
	expect(answer).toEqual(expect.stringContaining("not a git repository"));
});

workspace.it(
	"Effect callers receive GitError with the original command failure as a non-enumerable cause",
	[withoutGit],
	function* ({ checkThroughEffect }) {
		const failure = yield* checkThroughEffect();

		expect(failure).toEqual({
			cause: {
				exitCode: 128,
				stderr: expect.stringContaining("not a git repository"),
				stdout: "",
			},
			causeEnumerable: false,
			tag: "GitError",
		});
	},
);

workspace.it(
	"interrupting an Effect history read stops the read and its pending Git process",
	[],
	function* ({ gitHistoryRunning, historyReadStatus, interruptHistoryRead, startHistoryRead }) {
		yield* startHistoryRead();
		yield* outcomes([
			["history read", () => historyReadStatus(), "reading"],
			["Git process running", () => gitHistoryRunning(), true],
		]);

		yield* interruptHistoryRead();

		yield* outcomes([
			["history read", () => historyReadStatus(), "interrupted"],
			["Git process running", () => gitHistoryRunning(), false],
		]);
	},
);
