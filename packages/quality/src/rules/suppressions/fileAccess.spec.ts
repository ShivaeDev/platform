import { expect } from "vitest";
import { pendingRead, ruleFileAccess, suppliedConfig, unreadableConfig } from "#test/ruleFileAccess.ts";

ruleFileAccess.it(
	"suppressions/no-ignore-deprecations reports the tsconfig.json that the supplied file system serves, not the one on disk",
	[suppliedConfig],
	function* ({ checks, findings }) {
		yield* checks();

		expect(yield* findings()).toEqual(["tsconfig.json ignoreDeprecations"]);
	},
);

ruleFileAccess.it(
	"suppressions/no-ignore-deprecations fails with the file system's PermissionDenied when it cannot read tsconfig.json",
	[unreadableConfig],
	function* ({ checks, outcome }) {
		yield* checks();

		expect(yield* outcome()).toEqual(expect.stringMatching(/^failed: cannot read <root>\/tsconfig\.json: .*PermissionDenied/u));
	},
);

ruleFileAccess.it("interrupting the rule stops the file system listing it waits for", [pendingRead], function* ({ interrupts, listing }) {
	expect(yield* listing()).toBe("pending");

	yield* interrupts();

	expect(yield* listing()).toBe("stopped");
});
