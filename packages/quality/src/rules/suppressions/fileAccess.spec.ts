import { pendingRead, ruleFileAccess, suppliedConfig, unreadableConfig } from "#test/ruleFileAccess.ts";
import { assertThat } from "#testing/adapters/assertThat.ts";

ruleFileAccess.it(
	"suppressions/no-ignore-deprecations reports the tsconfig.json that the supplied file system serves, not the one on disk",
	[suppliedConfig],
	function* ({ checks, findings }) {
		yield* checks();

		yield* assertThat(yield* findings(), (actual) => actual.toEqual(["tsconfig.json ignoreDeprecations"]));
	},
);

ruleFileAccess.it(
	"suppressions/no-ignore-deprecations fails with the file system's PermissionDenied when it cannot read tsconfig.json",
	[unreadableConfig],
	function* ({ checks, outcome }) {
		yield* checks();

		yield* assertThat(yield* outcome(), (actual, expect) =>
			actual.toEqual(expect.stringMatching(/^failed: cannot read <root>\/tsconfig\.json: .*PermissionDenied/u)),
		);
	},
);

ruleFileAccess.it("interrupting the rule stops the file system listing it waits for", [pendingRead], function* ({ interrupts, listing }) {
	yield* assertThat(yield* listing(), (actual) => actual.toBe("pending"));

	yield* interrupts();

	yield* assertThat(yield* listing(), (actual) => actual.toBe("stopped"));
});
