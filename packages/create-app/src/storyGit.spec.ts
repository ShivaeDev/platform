import { expect } from "vitest";
import { application } from "#test/application.ts";
import { committedWorkspace, refusingGlobalHook } from "#test/traits.ts";

application.it(
	"the kit commits in a temporary repository without running the developer's global Git hooks",
	[refusingGlobalHook, committedWorkspace],
	function* ({ enclosingCommits }) {
		expect(yield* enclosingCommits()).toEqual(["Workspace <workspace@example.com>: Commit the workspace"]);
	},
);
