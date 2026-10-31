import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { revisionOf } from "@shivaedev/work-board/server/responses/records.ts";
import { boardFileStory, payloadBoundary } from "#test/boardFileStory.ts";
import { refusal } from "#test/refusal.ts";

const ID = `fleet-report.${revisionOf("payload")}`;

boardFileStory.it("two concurrent payload writes both return the first payload, which a later read returns", [], function* ({ files }) {
	expect(yield* files.payload(ID)).toBeUndefined();

	const [first, second] = yield* Effect.all([files.payload(ID, "first"), files.payload(ID, "second")], { concurrency: "unbounded" });

	expect(second).toBe(first);
	expect(yield* files.payload(ID)).toBe(first);
});

boardFileStory.it("a retained payload refuses a replacement and stays out of the Board sources", [], function* ({ files }) {
	const first = yield* files.payload(ID, "first");

	const replaced = yield* files.payload(ID, "replacement");

	expect(replaced).toBe(first);
	expect(yield* files.documents()).toEqual([]);
});

for (const boundary of ["root", "directory", "file"]) {
	boardFileStory.it(
		`a payload through a symlinked ${boundary} is refused for reads and writes and the outside file is kept`,
		[payloadBoundary(boundary, ID)],
		function* ({ files }) {
			yield* outcomes([
				["read", () => refusal(files.payload(ID)), expect.not.stringMatching(/^accepted$/u)],
				["write", () => refusal(files.payload(ID, "replacement")), expect.not.stringMatching(/^accepted$/u)],
				["outside file", () => files.externalSource(), "private"],
			]);
		},
	);
}
