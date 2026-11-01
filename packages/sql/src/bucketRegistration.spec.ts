import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { bucketRegistration } from "#test/bucketRegistration.ts";
import { bucketSubscribers } from "#test/bucketSubscribers.ts";

for (const kind of ["boolean", "bigint", "date", "object", "mixed union", "unknown"] as const) {
	bucketRegistration.it(`registration refuses ${kind} bucket values before any write`, [], function* ({ register, registration }) {
		yield* register(kind);

		expect(yield* registration()).toBe(
			'BucketRegistrationError: Bucket registration for bucket_registration: fields ["value"] must decode to strings, numbers or absent values',
		);
	});
}

bucketSubscribers.it(
	"a committed write refreshes query results for text-stored numeric zero and string buckets",
	[],
	function* ({ insert, listRows, ownerRows }) {
		yield* outcomes([
			["initial list rows", () => listRows(), []],
			["initial owner rows", () => ownerRows(), []],
		]);

		yield* insert("fresh note");

		yield* outcomes([
			["refreshed list rows", () => listRows(), ["fresh note"]],
			["refreshed owner rows", () => ownerRows(), ["fresh note"]],
		]);
	},
);
