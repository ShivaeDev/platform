import { expect } from "@effect/vitest";
import { mainAdvanced } from "#test/mainAdvanced.ts";
import { applied, onMain, pending } from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

workspace.it(
	"a queued release behind main refuses publishing and names every uncovered changeset's commit and the repair",
	[pending(), onMain, applied, mainAdvanced],
	function* ({ check }) {
		const answer = yield* check("main");

		expect(answer).toContain("refused: Release leaves pending changesets outside its notes: breaking.md, independent.md.");
		expect(answer).toMatch(/[a-f\d]+ Replace the core API; migrate to the new API\./u);
		expect(answer).toMatch(/[a-f\d]+ Correct independent dev behavior\./u);
		expect(answer).toContain("Let the release PR regenerate before merging or publishing.");
	},
);

workspace.it(
	"a release covering every pending changeset passes the publishing check after main advances",
	[pending(), onMain, mainAdvanced],
	function* ({ apply, check }) {
		yield* apply();

		expect(yield* check("main")).toBe("valid");
	},
);
