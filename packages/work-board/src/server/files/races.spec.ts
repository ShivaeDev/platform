import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { HomeMissing } from "#server/files/home.ts";
import { disappearsBeforeStat, fileReadingStory, readableFiles } from "#test/fileReadingStory.ts";

fileReadingStory.it(
	"reports the selected home disappearing between resolution and stat",
	[readableFiles({ "home.md": "# Home" }), disappearsBeforeStat("home.md")],
	function* ({ selectHome, root }) {
		const result = yield* selectHome("home.md").pipe(Effect.result);
		expect(result._tag === "Failure" && Schema.is(HomeMissing)(result.failure)).toBe(true);
		expect(result).toMatchObject({
			_tag: "Failure",
			failure: {
				_tag: "HomeMissing",
				message: `The home file home.md is not a markdown file in ${root}. Choose an existing Markdown file with --home.`,
			},
		});
	},
);
fileReadingStory.it(
	"lists readable files when another disappears before stat",
	[readableFiles({ "gone.md": "# Removed", "kept.md": "# Readable" }), disappearsBeforeStat("gone.md")],
	function* ({ listFiles }) {
		expect((yield* listFiles()).map((file) => file.path)).toEqual(["kept.md"]);
	},
);
