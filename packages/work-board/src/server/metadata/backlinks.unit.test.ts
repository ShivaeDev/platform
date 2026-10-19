import { expect, it } from "vitest";
import { backlinksOf } from "./backlinks.ts";
import { metadataModel } from "./model.ts";
import { metadataParse } from "./parse.ts";

it("resolves workspace references once per immutable model across different document opens", () => {
	let resolutions = 0;
	const source = {
		file: "source.md",
		get links() {
			resolutions += 1;
			return ["first.md", "second.md", "source.md"];
		},
		parsed: metadataParse("---\nrelationships:\n - kind: informs\n   target: first\n---\n# Source"),
	};
	const first = { file: "first.md", parsed: metadataParse("---\nid: first\n---\n# First") };
	const second = { file: "second.md", parsed: metadataParse("# Second") };
	const model = metadataModel([source, first, second]);
	expect(backlinksOf("first.md", model)).toEqual([
		{ file: "source.md", kind: "informs", line: 4 },
		{ file: "source.md", kind: "Markdown link" },
	]);
	const initial = resolutions;
	expect(backlinksOf("second.md", model)).toEqual([{ file: "source.md", kind: "Markdown link" }]);
	expect(backlinksOf("source.md", model)).toEqual([]);
	expect(resolutions).toBe(initial);
	const changed = metadataModel([first, second]);
	expect(backlinksOf("first.md", changed)).toEqual([]);
});
