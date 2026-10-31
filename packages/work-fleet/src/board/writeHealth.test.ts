import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardFileStory, healthBoundary } from "#test/boardFileStory.ts";
import { healthSnapshot } from "#test/health.ts";
import { refusal } from "#test/refusal.ts";

boardFileStory.it("published health reads back as the snapshot", [], function* ({ health }) {
	yield* health.publish(healthSnapshot);

	expect(yield* health.published()).toEqual(healthSnapshot);
});

boardFileStory.it("republishing identical health leaves the file untouched", [], function* ({ health }) {
	yield* health.publish(healthSnapshot);
	const first = yield* health.identity();

	yield* health.publish(healthSnapshot);

	expect(yield* health.identity()).toEqual(first);
});

boardFileStory.it(
	"a reader sees a whole version 2 snapshot during each of 20 replacements, and no temporary file remains",
	[],
	function* ({ health }) {
		yield* health.publish(healthSnapshot);

		const versions = yield* health.readWhileReplacing(healthSnapshot, 20);

		expect(versions).toEqual(Array.from({ length: 20 }, () => 2));
		yield* outcomes([
			["last snapshot", () => health.published(), { running: 19 }],
			["health folder", () => health.files(), ["health.json"]],
		]);
	},
);

for (const boundary of ["directory", "file"] as const) {
	boardFileStory.it(
		`health publication through a symlinked ${boundary} is refused and the outside file is kept`,
		[healthBoundary(boundary)],
		function* ({ health }) {
			const published = yield* refusal(health.publish(healthSnapshot));

			expect(published).toMatch(/^Board failure: /u);
			expect(yield* health.outsideSource()).toBe("Keep this source");
		},
	);
}

boardFileStory.it(
	"health publication over an authored health file is refused and the file is kept",
	[healthBoundary("occupied")],
	function* ({ health }) {
		const published = yield* refusal(health.publish(healthSnapshot));

		expect(published).toMatch(/^Board failure: /u);
		expect(yield* health.publishedSource()).toBe("Authored content");
	},
);

boardFileStory.it("a version 1 health snapshot is replaced with owner counts", [], function* ({ health }) {
	yield* health.writeLegacy({ ...healthSnapshot, version: 1, waiting: undefined });

	yield* health.publish(healthSnapshot);

	expect(yield* health.published()).toEqual(healthSnapshot);
});
