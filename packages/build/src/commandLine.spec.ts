import { expect } from "vitest";
import { generator, notesProject } from "#test/generator.ts";

generator.it(
	"shivaedev-build generate --check, run from source before any build, writes nothing and exits 1 listing the missing file with pnpm generate",
	[notesProject()],
	function* ({ generatedFile, runsFromSource }) {
		expect(yield* runsFromSource("generate", "--check")).toEqual({
			code: 1,
			printed: ["src/generated/modules/notes/notes.ts: missing"],
			problems: ["src/generated/modules/notes/notes.ts is missing; run `pnpm generate`"],
		});
		expect(yield* generatedFile("src/generated/modules/notes/notes.ts")).toBe("missing");
	},
);
