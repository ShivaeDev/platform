import { describe, expect, it } from "vitest";
import { otherNames } from "#rules/files/otherNames.ts";
import { checkRule } from "#test/support/inputs.ts";

const sources = [
	{ content: 'import "./ItemPanel.css";\n', path: "src/ItemPanel.tsx" },
	{ content: 'import "./panel-styles.css";\n', path: "src/OrderPanel.tsx" },
	{ content: 'import "./FormControls.css";\n', path: "src/Form.tsx" },
	{ content: 'import "./FormControls.css";\n', path: "src/Field.tsx" },
];

const files = [
	...sources.map((source) => source.path),
	"src/ItemPanel.css",
	"src/panel-styles.css",
	"src/FormControls.css",
	"src/form-controls.css",
	"README.md",
	"CHANGELOG.md",
	"docs/release-notes.md",
	"docs/ReleaseNotes.md",
	"docs/release.notes.md",
	"assets/logo-dark.svg",
	"assets/Logo_Dark.png",
	"biome/plugins/effect-fn-spans.grit",
	"biome/plugins/effectFnSpans.grit",
	"prisma/schema.prisma",
	"prisma/Schema.prisma",
	"content/forest_path.json",
	"content/forest-path.json",
	"tsconfig.build.json",
	".prettierrc.json",
	"Makefile",
];

describe("files/other-names", () => {
	it("flags documents, data, assets, GritQL files, stylesheets, Prisma schemas and content named against the scheme", async () => {
		const findings = await checkRule(otherNames, { content: ["content/"] }, { files, sources });
		expect(findings.map((finding) => finding.file)).toEqual([
			"src/panel-styles.css",
			"src/FormControls.css",
			"docs/ReleaseNotes.md",
			"assets/Logo_Dark.png",
			"biome/plugins/effectFnSpans.grit",
			"prisma/Schema.prisma",
			"content/forest-path.json",
		]);
	});

	it("names a stylesheet that one component imports after that component", async () => {
		const findings = await checkRule(otherNames, undefined, { files, sources });
		expect(findings.find((finding) => finding.file === "src/panel-styles.css")?.message).toBe(
			'"panel-styles" is styling for OrderPanel.tsx alone, so it is named OrderPanel.css.',
		);
		expect(findings.find((finding) => finding.file === "src/FormControls.css")?.message).toBe(
			'"FormControls" is a shared stylesheet, so it is named in kebab-case, such as form-controls.css.',
		);
	});
});
