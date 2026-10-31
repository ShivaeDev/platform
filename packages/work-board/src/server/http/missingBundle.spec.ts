import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { bundleNotBuilt } from "#test/servingStoryTraits.ts";

const plan = projectFiles({ "plan.md": "# Plan" });

for (const { asset, other, otherType, type } of [
	{ asset: "react.js", other: "react.css", otherType: "text/css", type: "text/javascript" },
	{ asset: "react.css", other: "react.js", otherType: "text/javascript", type: "text/css" },
] as const) {
	const instructions = `Work Board browser bundle assets/${asset} is missing. Run pnpm --filter @shivaedev/work-board build:browser from the repository root to build it.`;

	boardStory.it(
		`a board without its built ${asset} warns once at startup and not again when browsers ask for it`,
		[plan, bundleNotBuilt(asset)],
		function* ({ download, startupWarnings }) {
			expect(yield* startupWarnings()).toEqual([instructions]);

			yield* download(`/_board/${asset}`);
			yield* download(`/_board/${asset}`);

			expect(yield* startupWarnings()).toEqual([instructions]);
		},
	);

	boardStory.it(
		`a request for the unbuilt ${asset} answers Internal Server Error with the build instructions as plain text`,
		[plan, bundleNotBuilt(asset)],
		function* ({ download }) {
			expect(yield* download(`/_board/${asset}`)).toMatchObject({
				status: "Internal Server Error",
				text: instructions,
				type: "text/plain; charset=utf-8",
			});
		},
	);

	boardStory.it(
		`while ${asset} is unbuilt, the board still serves its page and ${other}`,
		[plan, bundleNotBuilt(asset)],
		function* ({ download, statusOf }) {
			yield* outcomes([
				["page", () => statusOf("/"), "OK"],
				[other, () => download(`/_board/${other}`), { status: "OK", type: otherType }],
			]);
		},
	);

	boardStory.it(`the unbuilt ${asset} is served once it has been built`, [plan, bundleNotBuilt(asset)], function* ({ buildBundle, download }) {
		expect(yield* download(`/_board/${asset}`)).toMatchObject({ status: "Internal Server Error" });

		const built = buildBundle(asset, "local");

		expect(yield* download(`/_board/${asset}`)).toMatchObject({ status: "OK", text: built, type });
	});
}
