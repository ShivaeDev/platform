import { describe, expect, it } from "vitest";
import { stylesheetImporters } from "#rules/files/stylesheetImporters.ts";
import { inputsOf } from "#test/inputs.ts";

describe("stylesheet importers", () => {
	it("counts relative CSS imports and query imports while leaving comments and CDN URLs alone", async () => {
		const found = await stylesheetImporters(
			inputsOf({
				files: ["src/main.ts", "src/theme.scss", "src/tokens.scss", "src/commented.scss"],
				sources: [{ content: 'import "./theme.scss?inline";', path: "src/main.ts" }],
				texts: {
					"src/theme.scss": '@import "tokens.scss";\n/* @import "./commented.scss"; */\n@import url("https://cdn.example.invalid/shared.scss");',
				},
			}),
		);
		expect([...found]).toEqual([
			["src/theme.scss", ["src/main.ts"]],
			["src/tokens.scss", ["src/theme.scss"]],
		]);
	});

	it.fails("counts an exact package alias whose specifier has no stylesheet extension", async () => {
		const found = await stylesheetImporters(
			inputsOf({
				files: ["package.json", "src/main.ts", "src/theme.scss"],
				sources: [{ content: 'import "#theme";', path: "src/main.ts" }],
				texts: { "package.json": JSON.stringify({ imports: { "#theme": "./src/theme.scss" } }) },
			}),
		);
		expect([...found]).toEqual([["src/theme.scss", ["src/main.ts"]]]);
	});
});
