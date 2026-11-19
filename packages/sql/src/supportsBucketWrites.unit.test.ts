import { expect, it } from "vitest";
import { supportsBucketWrites } from "#supportsBucketWrites.ts";

it.each([
	[160_004, false],
	[170_009, false],
	[179_999, false],
	[180_000, true],
	[180_006, true],
	[190_001, true],
] as const)("server_version_num %i supports bucketed writes: %s", (serverVersionNum, supported) => {
	expect(supportsBucketWrites(serverVersionNum)).toBe(supported);
});
