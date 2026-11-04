import { expect } from "@effect/vitest";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { ascii } from "./ascii.ts";

ruleStory.it(
	"ASCII accepts selected text containing tabs, CRLF and ASCII escapes",
	[repositoryHas({ content: "Plain text\t123\r\n\\u00e9\r\n", path: "docs/guide.txt" })],
	function* ({ check }) {
		const findings = yield* check(ascii, { files: ["docs/**/*.txt"] });

		expect(findings).toEqual([]);
	},
);

ruleStory.it(
	"ASCII reports each selected non-ASCII line and leaves other text alone",
	[repositoryHas({ content: "Plain text\nCaf\u00e9\n\u{1F680}\n", path: "docs/guide.txt" }, { content: "Caf\u00e9", path: "docs/other.md" })],
	function* ({ check }) {
		const findings = yield* check(ascii, { files: ["docs/**/*.txt"] });

		expect(findings).toEqual(
			[2, 3].map((line) => ({
				file: "docs/guide.txt",
				line,
				message: "This file is ASCII-only. Replace non-ASCII characters with ASCII text or escapes.",
			})),
		);
	},
);

ruleStory.it("ASCII selects no files by default", [repositoryHas({ content: "Caf\u00e9", path: "docs/guide.txt" })], function* ({ check }) {
	const findings = yield* check(ascii);

	expect(findings).toEqual([]);
});

ruleStory.it(
	"ASCII reports a UTF-8 BOM in an explicitly selected file",
	[repositoryHas({ content: "\uFEFFText\n", path: "guide.txt" })],
	function* ({ check, locations }) {
		yield* check(ascii, { files: ["guide.txt"] });

		expect(yield* locations()).toEqual(["guide.txt:1"]);
	},
);
