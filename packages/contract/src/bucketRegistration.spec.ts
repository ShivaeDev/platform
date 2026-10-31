import { Schema } from "effect";
import { expect } from "vitest";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { workspaces } from "#test/collectionContract.ts";
import { collectionStory } from "#test/collectionStory.ts";

for (const [mismatch, keys, name, fields] of [
	["missing collection", undefined, undefined, []],
	["wrong table", collection("other", Schema.Int, { tenant: Schema.String }), "other", ["tenant"]],
	["missing bucket", collection("workspaces", Schema.Int), "workspaces", []],
	["wrong field", collection("workspaces", Schema.Int, { owner: Schema.String }), "workspaces", ["owner"]],
	["extra bucket", collection("workspaces", Schema.Int, { tenant: Schema.String, title: Schema.String }), "workspaces", ["tenant", "title"]],
] as const) {
	collectionStory.it(`repository registration refuses a ${mismatch} and names the declarations that disagree`, [], function* ({ register }) {
		const answer = yield* register(keys);

		expect(answer).toEqual({
			collection: name,
			collectionFields: fields,
			error: "BucketRegistrationError",
			modelFields: ["tenant"],
			table: "workspaces",
		});
	});
}

collectionStory.it("a generated-id insert asserts its own record and bucket keys from its result", [], function* ({ insertWithExpectedKeys }) {
	const row = yield* insertWithExpectedKeys("alice", "Generated", ({ id, tenant }) =>
		invalidationKeys([workspaces.item(id), workspaces.bucket.tenant(tenant)]),
	);

	expect(row).toMatchObject({ tenant: "alice", title: "Generated" });
	expect(row.id).toBeGreaterThan(0);
});
