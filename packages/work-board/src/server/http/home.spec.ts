import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { filesystemIgnoresCase, hiddenPlanCopy, homeLinksOutside, homeRefusal, planAliases } from "#test/servingStoryTraits.ts";
import { outsideFiles } from "#test/servingTraits.ts";

const ignoresCase = filesystemIgnoresCase();
const workspace = projectFiles({
	".drafts/hidden.md": "# Hidden\n",
	"notes/log.md": "# Log\n",
	"plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n",
	"Upper.md": "# Upper\n\n## Doing\n\n### One\n",
});

boardStory.it("a home given as ./notes/../plan.md opens plan.md", [workspace, deferredServing], function* ({ homeFile, launch }) {
	yield* launch({ home: "./notes/../plan.md" });

	expect(yield* homeFile()).toBe("plan.md");
});

boardStory.it("the board refuses to start when the home names no file", [workspace, deferredServing], function* ({ launch }) {
	expect(yield* launch({ home: "missing.md" })).toBe(homeRefusal("missing.md"));
});

boardStory.it(
	"the board refuses to start when the home is a symlink to a file outside the workspace",
	[workspace, outsideFiles({ "private.md": "# Outside the folder\n" }), homeLinksOutside, deferredServing],
	function* ({ launch }) {
		expect(yield* launch({ home: "home-link.md" })).toBe(homeRefusal("home-link.md"));
	},
);

boardStory.it.runIf(ignoresCase)(
	"where the file system ignores case, a home named upper.md opens the listed Upper.md and its document",
	[workspace, deferredServing],
	function* ({ documentAt, homeFile, launch }) {
		yield* launch({ home: "upper.md" });

		yield* outcomes([
			["home document", () => documentAt("/Upper.md"), "# Upper\n\n## Doing\n\n### One\n"],
			["home file", () => homeFile(), "Upper.md"],
		]);
	},
);

boardStory.it.skipIf(ignoresCase)(
	"where the file system respects case, the board refuses a home named upper.md",
	[workspace, deferredServing],
	function* ({ launch }) {
		expect(yield* launch({ home: "upper.md" })).toBe(homeRefusal("upper.md"));
	},
);

boardStory.it.runIf(ignoresCase)(
	"where the file system ignores case, a home named PLAN.md opens plan.md rather than its symlink or hard link",
	[workspace, planAliases, deferredServing],
	function* ({ homeFile, launch }) {
		yield* launch({ home: "PLAN.md" });

		expect(yield* homeFile()).toBe("plan.md");
	},
);

boardStory.it(
	"a home named by its hidden hard link opens plan.md, not alias.md, the symlink that also leads there",
	[workspace, hiddenPlanCopy, deferredServing],
	function* ({ homeFile, launch }) {
		yield* launch({ home: ".drafts/plan-copy.md" });

		expect(yield* homeFile()).toBe("plan.md");
	},
);
