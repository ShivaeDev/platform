import { describe, expect, it } from "vitest";
import { checkRule } from "#test/inputs.ts";
import { maxDepth } from "./maxDepth.ts";

describe("nesting/max-depth", () => {
	it("reports each line indented with eight or more tabs with its location", async () => {
		expect(
			await checkRule(maxDepth, undefined, { sources: [{ content: `ok\n${"\t".repeat(8)}value\n${"\t".repeat(9)}deeper`, path: "src/deep.ts" }] }),
		).toEqual([
			{ file: "src/deep.ts", line: 2, message: "Indentation is 8+ tabs deep. Extract a named function or component." },
			{ file: "src/deep.ts", line: 3, message: "Indentation is 8+ tabs deep. Extract a named function or component." },
		]);
	});
	it("accepts seven tabs and ignores declaration files", async () => {
		expect(
			await checkRule(maxDepth, undefined, {
				sources: [
					{ content: `${"\t".repeat(7)}value`, path: "src/shallow.tsx" },
					...["ts", "mts", "cts"].map((extension) => ({ content: `${"\t".repeat(8)}value`, path: `src/types.d.${extension}` })),
				],
			}),
		).toEqual([]);
	});
});
