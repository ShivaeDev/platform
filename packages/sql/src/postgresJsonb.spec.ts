import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { partialWrites, profileStored } from "#test/partialWrites.ts";

const keys = [["profiles", "profiles:1", '["bucket","profiles","owner","alice"]']];

partialWrites.it(
	"a jsonb insert stores encoded nested values, decodes them through the model on reads and publishes its keys",
	[],
	function* ({ insertProfile, returned, profileDetails, storedDetails, publications }) {
		const details = { amount: 52, routes: [{ routeKey: "settings" }] };

		yield* insertProfile(details);

		yield* outcomes([
			["returned profile", () => returned(), [{ details }]],
			["repository projection", () => profileDetails(), [details]],
			["stored JSON", () => storedDetails(), { sqlNull: false, value: { ...details, amount: "52" } }],
			["published keys", () => publications(), keys],
		]);
	},
);

for (const details of [{ amount: 99, routes: [] }, null]) {
	partialWrites.it(
		`a chosen-column jsonb update stores and decodes ${details === null ? "SQL null" : "new details with an empty array"} and publishes its keys`,
		[profileStored()],
		function* ({ updateDetails, returned, profileDetails, storedDetails, publications }) {
			yield* updateDetails(details);

			yield* outcomes([
				["returned profile", () => returned(), [{ details }]],
				["repository projection", () => profileDetails(), [details]],
				["stored JSON", () => storedDetails(), { sqlNull: details === null, value: details === null ? null : { amount: "99", routes: [] } }],
				["published keys", () => publications(), keys],
			]);
		},
	);
}

partialWrites.it(
	"a jsonb insert with details that fail the model schema writes nothing and publishes nothing",
	[],
	function* ({ insertInvalidDetails, endings, profileDetails, publications }) {
		yield* insertInvalidDetails();

		yield* outcomes([
			["write ending", () => endings(), ["failed with a schema error"]],
			["repository projection", () => profileDetails(), []],
			["published keys", () => publications(), []],
		]);
	},
);

partialWrites.it(
	"a jsonb object that violates the model fails a repository projection with a schema error",
	[profileStored()],
	function* ({ writeMalformedDetails, profileDetails }) {
		yield* writeMalformedDetails();

		expect(yield* profileDetails()).toBe("failed with a schema error");
	},
);
