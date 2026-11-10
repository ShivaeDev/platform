import { expect } from "vitest";
import { application } from "#test/application.ts";
import { generated, linkedPackageScripts } from "#test/traits.ts";
import { webhooksFeature } from "#test/webhooksFeature.ts";

application.it(
	"a generated app typechecks two features with different queue payloads",
	[linkedPackageScripts, generated("my-app", "--no-git"), webhooksFeature],
	function* ({ typecheck }) {
		expect(yield* typecheck()).toBe("passed");
	},
	120_000,
);
