import { expect } from "@effect/vitest";
import { CLI_TIMEOUT } from "@shivaedev/test-kits/quality/adapters/cli.ts";
import { baselineStory } from "#test/baselineStory.ts";
import { packageWorkspace, shardsRecorded } from "#test/packageWorkspace.ts";

baselineStory.it(
	"lint honours the debt in a package's shard and rejects a package file that grows past it",
	[packageWorkspace(), shardsRecorded()],
	function* ({ lengthens, lint }) {
		expect(yield* lint()).toBe("passed");

		yield* lengthens("packages/alpha/src/a.ts", 7);

		expect(yield* lint()).toBe("rejected");
	},
	CLI_TIMEOUT,
);
