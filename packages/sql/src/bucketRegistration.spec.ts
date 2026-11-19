import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { bucketRegistration, type Declared } from "#test/bucketRegistration.ts";
import { bucketSubscribers } from "#test/bucketSubscribers.ts";

for (const kind of ["boolean", "bigint", "date", "object", "mixed union", "unknown"] as const) {
	bucketRegistration.it(`registration refuses ${kind} bucket values before any write`, [], function* ({ register, registration }) {
		yield* register(kind);

		expect(yield* registration()).toBe(
			'BucketRegistrationError: Bucket registration for bucket_registration: fields ["value"] must decode to strings, numbers or absent values',
		);
	});
}

for (const column of ["missing", "flag"] as const) {
	bucketRegistration.it(
		`registration refuses a tuple bucket over the ${column} column before any write`,
		[],
		function* ({ registerTuple, registration }) {
			yield* registerTuple(column);

			expect(yield* registration()).toBe(
				`BucketRegistrationError: Bucket registration for bucket_registration: tuple columns ["ownerTuple.${column}"] must be model fields that decode to strings, numbers or absent values`,
			);
		},
	);
}

const refusals: readonly { readonly declared: Declared; readonly claim: string; readonly refusal: string }[] = [
	{
		claim: "names both names and says the collection name must equal the table name",
		declared: "a collection named bucketRegistration",
		refusal: 'collection name "bucketRegistration" must equal table name "bucket_registration", because the collection name is the table name',
	},
	{
		claim: "says the collection bucket fields must equal the model's",
		declared: "a collection with a title bucket",
		refusal: 'collection bucket fields ["title"] must equal model bucket fields ["ownerId"]',
	},
	{
		claim: "names both disagreements",
		declared: "a collection named bucketRegistration with a title bucket",
		refusal:
			'collection name "bucketRegistration" must equal table name "bucket_registration", because the collection name is the table name; collection bucket fields ["title"] must equal model bucket fields ["ownerId"]',
	},
	{
		claim: "says which collection the repository needs",
		declared: "no collection",
		refusal:
			'model bucket fields ["ownerId"] need the repository\'s collection option, a collection named "bucket_registration" with exactly those bucket fields',
	},
];

for (const { claim, declared, refusal } of refusals) {
	bucketRegistration.it(`registration with ${declared} ${claim}`, [], function* ({ registerCollection, registration }) {
		yield* registerCollection(declared);

		expect(yield* registration()).toBe(`BucketRegistrationError: Bucket registration for bucket_registration: ${refusal}`);
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
