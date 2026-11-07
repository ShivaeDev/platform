import { expect } from "vitest";
import { pinnedStarter, registryUnavailable, releasePin } from "#package-check/test-support/pinnedStarter.ts";

for (const workspaceVersion of ["1.0.0", "1.1.0"]) {
	pinnedStarter.it(
		`a published starter pin exposes the incompatible adapter even when workspace ${workspaceVersion} accepts it`,
		[releasePin("1.0.0", workspaceVersion)],
		function* ({ typecheck }) {
			expect(yield* typecheck()).toContain("Expected 2 arguments, but got 3");
		},
	);
}

pinnedStarter.it(
	"an unpublished starter catalog pin typechecks against its matching release archive",
	[releasePin("1.1.0")],
	function* ({ typecheck }) {
		expect(yield* typecheck()).toBeUndefined();
	},
);

pinnedStarter.it("a registry outage fails instead of substituting workspace sources", [registryUnavailable], function* ({ typecheck }) {
	expect(yield* typecheck()).toContain("npm lookup for @fixture/starter-pin failed with HTTP 503");
});
