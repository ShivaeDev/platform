import { expect } from "@effect/vitest";
import { CORE } from "#test/fixture.ts";
import {
	changesetDeleted,
	changesetEdited,
	historyRewritten,
	mergingReleaseFromMain,
	onMain,
	pending,
	privateWithoutChangelog,
	released,
	versionSet,
} from "#test/traits.ts";
import { workspace } from "#test/workspace.ts";

const historyNeedsBump = `refused: ${CORE}: CHANGELOG.md changes require a version bump; add .changeset/<name>.md and run releases apply.`;

workspace.it(
	"check accepts a release while the private @test/private has no changelog",
	[privateWithoutChangelog, pending(), released],
	function* ({ check }) {
		expect(yield* check()).toBe("valid");
	},
);

for (const withAnotherBranch of [false, true]) {
	workspace.it(
		`check accepts ${CORE}'s 0.2.4 release merged in from main while the merge of main${withAnotherBranch ? " and another branch" : ""} is uncommitted`,
		[mergingReleaseFromMain({ withAnotherBranch })],
		function* ({ check }) {
			expect(yield* check()).toBe("valid");
		},
	);
}

workspace.it(
	`check refuses an edit to ${CORE}'s released history without a version bump while main is merged in uncommitted`,
	[mergingReleaseFromMain({ withAnotherBranch: false }), historyRewritten(CORE)],
	function* ({ check }) {
		expect(yield* check()).toBe(historyNeedsBump);
	},
);

workspace.it(`check refuses an edit to ${CORE}'s released history without a version bump`, [historyRewritten(CORE)], function* ({ check }) {
	expect(yield* check()).toBe(historyNeedsBump);
});

workspace.it(`check refuses ${CORE}'s version bump to 0.2.4 outside a release`, [versionSet(CORE, "0.2.4")], function* ({ check }) {
	expect(yield* check()).toBe("refused: A release needs deleted pending changesets from the base; restore versions and run releases apply.");
});

for (const [description, change] of [
	["deleted", changesetDeleted("feature")],
	["edited into a Fixed patch", changesetEdited("feature", { [CORE]: "patch" }, "### Fixed\n\n- A fix.\n")],
] as const) {
	workspace.it(`check refuses main's pending feature.md ${description} without a release`, [pending(), onMain, change], function* ({ check }) {
		expect(yield* check()).toBe(
			"refused: feature.md: keep pending changesets unchanged; add a new file for later changes or run releases apply to consume them.",
		);
	});
}

workspace.it("check names a missing base and the fetch command", [], function* ({ check }) {
	expect(yield* check("missing-ref")).toBe(
		"refused: Cannot resolve changeset base missing-ref; run git fetch origin main or pass an existing base-ref with full history.",
	);
});
