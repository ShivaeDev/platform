import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { generatedOnce, generator, notesProject, ownFileInGenerated } from "#test/generator.ts";

const NOTES = "src/generated/modules/notes/notes.ts";
const NOTEBOOK = "src/generated/modules/notes/notebook.ts";
const ROUTES = "src/generated/routes.ts";
const ROUTES_TEXT = "export const routes = [];\n";

generator.it(
	"after the notes module is renamed, generate --check lists its old file as left from it, and generate removes that file but keeps one under src/generated that it did not write",
	[notesProject(), ownFileInGenerated(ROUTES, ROUTES_TEXT), generatedOnce()],
	function* ({ generatedFile, generates, generatesWithCheck, renames }) {
		yield* renames("src/modules/notes/notes.ts", "src/modules/notes/notebook.ts");

		yield* outcomes([
			[
				"generate --check",
				() => generatesWithCheck(),
				{
					files: { [NOTEBOOK]: "missing", [NOTES]: "orphaned" },
					problems: [
						`${NOTEBOOK} is missing; run \`pnpm generate\``,
						`${NOTES} is left from src/modules/notes/notes.ts, which defines no module any more; run \`pnpm generate\``,
					],
					result: "failed",
				},
			],
			["generate", () => generates(), { files: { [NOTEBOOK]: "written", [NOTES]: "removed" }, problems: [], result: "succeeded" }],
			["the old file", () => generatedFile(NOTES), "missing"],
			["the application's own file", () => generatedFile(ROUTES), ROUTES_TEXT],
		]);
	},
);
