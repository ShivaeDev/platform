import { expect } from "@effect/vitest";
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
