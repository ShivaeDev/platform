import { describe, expect, it } from "vitest";
import { packageImports } from "#rules/files/packageImports.ts";
import { inputsOf } from "#test/inputs.ts";

describe("stylesheet package imports", () => {
	it("uses an exact alias before wildcard patterns, and resolves conditional arrays to a checked file", async () => {
		const resolve = await packageImports(
			inputsOf({
				files: ["package.json", "src/theme.scss", "src/styles/card.scss"],
				texts: {
					"package.json": JSON.stringify({
						imports: {
							"#styles/*": "./src/styles/*",
							"#styles/theme.scss": [null, { browser: "./missing.scss", default: "./src/theme.scss" }],
						},
					}),
				},
			}),
		);
		expect(resolve("src/main.ts", "#styles/theme.scss")).toBe("src/theme.scss");
		expect(resolve("src/main.ts", "#styles/card.scss")).toBe("src/styles/card.scss");
		expect(resolve("src/main.ts", "#unknown")).toBeUndefined();
	});

	it.fails("chooses the longer suffix when alias patterns have the same prefix", async () => {
		const resolve = await packageImports(
			inputsOf({
				files: ["package.json", "generic/card.scss", "styles/card.scss"],
				texts: {
					"package.json": JSON.stringify({
						imports: {
							"#styles/*": "./generic/*",
							"#styles/*.scss": "./styles/*.scss",
						},
					}),
				},
			}),
		);
		expect(resolve("src/main.ts", "#styles/card.scss")).toBe("styles/card.scss");
	});

	it("uses the closest package manifest without falling back to a parent's private aliases", async () => {
		const resolve = await packageImports(
			inputsOf({
				files: ["package.json", "packages/web/package.json", "root.scss", "packages/web/theme.scss"],
				texts: {
					"package.json": JSON.stringify({ imports: { "#root": "./root.scss", "#theme": "./root.scss" } }),
					"packages/web/package.json": JSON.stringify({ imports: { "#theme": "./theme.scss" } }),
				},
			}),
		);
		expect(resolve("packages/web/main.ts", "#theme")).toBe("packages/web/theme.scss");
		expect(resolve("packages/web/main.ts", "#root")).toBeUndefined();
		expect(resolve("main.ts", "#theme")).toBe("root.scss");
	});

	it.each([undefined, "{", "null", '{"imports": null}'])("ignores an unreadable or missing alias map %s", async (manifest) => {
		const resolve = await packageImports(
			inputsOf({
				files: ["packages/web/package.json", "theme.scss"],
				texts: manifest === undefined ? {} : { "packages/web/package.json": manifest },
			}),
		);
		expect(resolve("packages/web/main.ts", "#theme")).toBeUndefined();
		expect(resolve("other/main.ts", "#theme")).toBeUndefined();
	});
});
