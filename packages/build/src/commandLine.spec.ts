import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { generator, notesProject } from "#test/generator.ts";

generator.it(
	"shivaedev-build generate --check, run from source before any build, writes nothing and exits 1 listing the missing file with pnpm generate",
	[notesProject()],
	function* ({ generatedFile, runsFromSource }) {
		yield* outcomes([
			[
				"generate --check",
				() => runsFromSource("generate", "--check"),
				{
					code: 1,
					printed: ["src/generated/modules/notes/notes.ts: missing"],
					problems: ["src/generated/modules/notes/notes.ts is missing; run `pnpm generate`"],
				},
			],
			["the generated file", () => generatedFile("src/generated/modules/notes/notes.ts"), "missing"],
		]);
	},
);
