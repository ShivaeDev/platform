import { expect } from "vitest";
import { otherNames } from "#rules/files/otherNames.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";
import { stylesheetImports } from "#test/stylesheetImports.ts";

const { importing, manifest, stylesheet } = stylesheetImports;

ruleStory.it(
	"files/other-names names a stylesheet that one component imports after that component",
	[repositoryHas(importing("src/OrderPanel.tsx", "./panel-styles.css"), stylesheet("src/panel-styles.css"))],
	function* ({ check, messages }) {
		yield* check(otherNames);

		expect(yield* messages()).toEqual(['"panel-styles" is styling for OrderPanel.tsx alone, so it is named OrderPanel.css.']);
	},
);

ruleStory.it(
	"files/other-names names a stylesheet that two components import in kebab-case",
	[
		repositoryHas(
			importing("src/Form.tsx", "./FormControls.css"),
			importing("src/Field.tsx", "./FormControls.css"),
			stylesheet("src/FormControls.css"),
		),
	],
	function* ({ check, messages }) {
		yield* check(otherNames);

		expect(yield* messages()).toEqual(['"FormControls" is a shared stylesheet, so it is named in kebab-case, such as form-controls.css.']);
	},
);

ruleStory.it(
	"files/other-names accepts a stylesheet named after its one component and a kebab-case stylesheet two components share",
	[
		repositoryHas(
			importing("src/ItemPanel.tsx", "./ItemPanel.css"),
			stylesheet("src/ItemPanel.css"),
			importing("src/Form.tsx", "./form-controls.css"),
			importing("src/Field.tsx", "./form-controls.css"),
			stylesheet("src/form-controls.css"),
		),
	],
	function* ({ check }) {
		expect(yield* check(otherNames)).toEqual([]);
	},
);

for (const rule of ['@import "./Card.css";', '@import url("./Card.css");', '@import "Card.css";']) {
	ruleStory.it(
		`files/other-names counts ${rule} in another stylesheet as an import, so a component's Card.css is shared`,
		[repositoryHas(importing("src/Card.tsx", "./Card.css"), stylesheet("src/Card.css"), stylesheet("src/theme.css", `${rule}\n`))],
		function* ({ check, locations }) {
			yield* check(otherNames);

			expect(yield* locations()).toEqual(["src/Card.css"]);
		},
	);
}

ruleStory.it(
	"files/other-names does not count an @import inside a CSS comment",
	[repositoryHas(importing("src/Card.tsx", "./Card.css"), stylesheet("src/Card.css"), stylesheet("src/theme.css", '/* @import "./Card.css"; */\n'))],
	function* ({ check }) {
		expect(yield* check(otherNames)).toEqual([]);
	},
);

ruleStory.it(
	"files/other-names counts an import with a query as importing the stylesheet",
	[repositoryHas(importing("src/Main.tsx", "./theme.scss?inline"), stylesheet("src/theme.scss"))],
	function* ({ check, messages }) {
		yield* check(otherNames);

		expect(yield* messages()).toEqual(['"theme" is styling for Main.tsx alone, so it is named Main.scss.']);
	},
);

ruleStory.it(
	"files/other-names does not count a test that resolves a stylesheet's path as importing it",
	[
		repositoryHas(importing("src/Panel.tsx", "./panel.css"), stylesheet("src/panel.css"), {
			content: 'import { resolve } from "node:path";\nexport const sheet = resolve(import.meta.dirname, "./panel.css");\n',
			path: "src/sheets.test.ts",
		}),
	],
	function* ({ check, messages }) {
		yield* check(otherNames);

		expect(yield* messages()).toEqual(['"panel" is styling for Panel.tsx alone, so it is named Panel.css.']);
	},
);

ruleStory.it(
	"files/other-names follows a package import alias to the stylesheet a component imports",
	[
		repositoryHas(
			manifest("package.json", { "#styles/*": "./src/styles/*" }),
			importing("src/Dialog.tsx", "#styles/dialog-sheet.css"),
			stylesheet("src/styles/dialog-sheet.css"),
		),
	],
	function* ({ check, messages }) {
		yield* check(otherNames);

		expect(yield* messages()).toEqual(['"dialog-sheet" is styling for Dialog.tsx alone, so it is named Dialog.css.']);
	},
);

ruleStory.it(
	"files/other-names resolves an exact package import alias before a wildcard, to the first condition that names an existing file",
	[
		repositoryHas(
			manifest("package.json", {
				"#styles/*": "./src/styles/*",
				"#styles/theme.scss": [null, { browser: "./missing.scss", default: "./src/theme.scss" }],
			}),
			importing("src/Panel.tsx", "#styles/theme.scss"),
			stylesheet("src/theme.scss"),
			stylesheet("src/styles/theme.scss"),
		),
	],
	function* ({ check, locations }) {
		yield* check(otherNames);

		expect(yield* locations()).toEqual(["src/theme.scss"]);
	},
);

ruleStory.it(
	"files/other-names resolves a package import alias through the closest package manifest",
	[
		repositoryHas(
			manifest("package.json", { "#theme.scss": "./root.scss" }),
			manifest("packages/web/package.json", { "#theme.scss": "./theme.scss" }),
			importing("packages/web/Main.tsx", "#theme.scss"),
			stylesheet("root.scss"),
			stylesheet("packages/web/theme.scss"),
		),
	],
	function* ({ check, locations }) {
		yield* check(otherNames);

		expect(yield* locations()).toEqual(["packages/web/theme.scss"]);
	},
);

ruleStory.it(
	"files/other-names does not resolve an alias of a parent package from a nested package",
	[
		repositoryHas(
			manifest("package.json", { "#root.scss": "./root.scss" }),
			manifest("packages/web/package.json", { "#theme.scss": "./theme.scss" }),
			importing("packages/web/Main.tsx", "#root.scss"),
			stylesheet("root.scss"),
		),
	],
	function* ({ check }) {
		expect(yield* check(otherNames)).toEqual([]);
	},
);

ruleStory.it.fails(
	"files/other-names resolves the alias pattern with the longer suffix when two share a prefix, as Node does",
	[
		repositoryHas(
			manifest("package.json", { "#styles/*": "./generic/*", "#styles/*.scss": "./styles/*.scss" }),
			importing("src/Main.tsx", "#styles/card.scss"),
			stylesheet("generic/card.scss"),
			stylesheet("styles/card.scss"),
		),
	],
	function* ({ check, locations }) {
		yield* check(otherNames);

		expect(yield* locations()).toEqual(["styles/card.scss"]);
	},
);

ruleStory.it.fails(
	"files/other-names follows an exact package import alias whose specifier has no stylesheet extension",
	[repositoryHas(manifest("package.json", { "#theme": "./src/theme.scss" }), importing("src/Main.tsx", "#theme"), stylesheet("src/theme.scss"))],
	function* ({ check, locations }) {
		yield* check(otherNames);

		expect(yield* locations()).toEqual(["src/theme.scss"]);
	},
);
