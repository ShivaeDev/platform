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
	"content/village_dialect__able.json",
	"content/village_dialect___able.json",
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
			"content/village_dialect___able.json",
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

	it("counts only module imports and CSS @import as importing a stylesheet", async () => {
		const manifest = JSON.stringify({ imports: { "#styles/*": "./src/styles/*" }, name: "@demo/ui" });
		const owned = [
			{ content: 'import "./Panel.css";\n', path: "packages/ui/src/Panel.tsx" },
			{
				content: 'import { resolve } from "node:path";\nexport const sheet = resolve(import.meta.dirname, "./Panel.css");\n',
				path: "packages/ui/src/sheets.test.ts",
			},
			{ content: 'import "./tokens.css";\n', path: "packages/ui/src/Card.tsx" },
			{ content: 'import "./badge-base.css";\n', path: "packages/ui/src/Badge.tsx" },
			{ content: 'import "#styles/Dialog.css";\n', path: "packages/ui/src/Dialog.tsx" },
		];
		const stylesheets = {
			"packages/ui/src/badge-base.css": "",
			"packages/ui/src/Panel.css": "",
			"packages/ui/src/styles/Dialog.css": "",
			"packages/ui/src/theme.css": '@import "./tokens.css";\n@import url("./badge-base.css");\n',
			"packages/ui/src/tokens.css": "",
		};
		const findings = await checkRule(otherNames, undefined, {
			files: [...owned.map((source) => source.path), "packages/ui/package.json", ...Object.keys(stylesheets)],
			sources: owned,
			texts: { ...stylesheets, "packages/ui/package.json": manifest },
		});
		expect(findings).toEqual([]);
	});
});
