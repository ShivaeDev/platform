import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { removeSeededTrees, seedTree } from "#test/tree.ts";
import { exceptionConfig, withExceptionConfig } from "./exceptionConfig.ts";

afterEach(removeSeededTrees);

const REASON = "The external format requires it.";

describe("Biome exception config", () => {
	it("generates native overrides and directory exclusions from the single declaration", () => {
		expect(
			exceptionConfig([
				{
					files: ["src/parse.ts"],
					reason: REASON,
					rules: ["comments/no-jsdoc", "biome/lint/suspicious/noExplicitAny", "biome/assist/source/useSortedKeys"],
				},
				{ files: ["**", "!**/generated"], reason: REASON, rules: ["biome/files/includes"] },
			]),
		).toEqual({
			includes: ["**", "!**/generated"],
			overrides: [
				{ includes: ["src/parse.ts"], linter: { rules: { suspicious: { noExplicitAny: "off" } } } },
				{ assist: { actions: { source: { useSortedKeys: "off" } } }, includes: ["src/parse.ts"] },
			],
		});
	});

	it.each([undefined, ["**", "!**/vendor"], ["src/**", "!src/vendor"]])(
		"merges multiple directory declarations without re-including exclusions from %j",
		async (previous) => {
			const declarations = [
				{ files: ["**", "!**/generated"], reason: REASON, rules: ["biome/files/includes"] },
				{ files: ["**", "!**/fixtures"], reason: REASON, rules: ["biome/files/includes"] },
			] as const;
			expect(exceptionConfig(declarations).includes).toEqual(["**", "!**/generated", "!**/fixtures"]);
			const root = seedTree([{ content: JSON.stringify({ files: { includes: previous } }), path: "biome.json" }]);
			await withExceptionConfig(root, declarations, (args) => {
				const path = args[0]?.slice("--config-path=".length) ?? "";
				expect(JSON.parse(readFileSync(path, "utf8")).files.includes).toEqual([
					...(previous ?? ["**"]),
					"!**/generated",
					"!**/fixtures",
					`!${path.slice(root.length + 1)}`,
				]);
				return Promise.resolve();
			});
		},
	);

	it.each([{ files: false }, { files: { includes: "src/**" } }, { overrides: {} }])(
		"rejects malformed native config before running Biome: %j",
		async (native) => {
			const root = seedTree([{ content: JSON.stringify(native), path: "biome.json" }]);
			await expect(
				withExceptionConfig(root, [{ files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny"] }], () =>
					Promise.reject(new Error("must not run")),
				),
			).rejects.toThrow("Cannot merge exceptions into invalid biome.json");
			expect(readdirSync(root)).toEqual(["biome.json"]);
		},
	);

	it.each([false, true])("keeps the root config and removes the temporary config, including on failure (%s)", async (fail) => {
		const native = {
			extends: ["@shivaedev/quality/biome"],
			formatter: { lineWidth: 150 },
			overrides: [{ formatter: { lineWidth: 100 }, includes: ["src/other.ts"] }],
			plugins: ["./imports.grit"],
		};
		const text = `// Repository config\n${JSON.stringify(native)}\n`;
		const root = seedTree([{ content: text, path: "biome.jsonc" }]);
		let generated = "";
		const run = withExceptionConfig(root, [{ files: ["src/parse.ts"], reason: REASON, rules: ["biome/lint/suspicious/noExplicitAny"] }], (args) => {
			generated = args[0]?.slice("--config-path=".length) ?? "";
			expect(generated).toContain(root);
			expect(JSON.parse(readFileSync(generated, "utf8"))).toMatchObject({
				...native,
				files: { includes: expect.arrayContaining(["**"]) },
				overrides: expect.arrayContaining(native.overrides),
			});
			expect(readFileSync(join(root, "biome.jsonc"), "utf8")).toBe(text);
			if (fail) {
				return Promise.reject(new Error("stopped"));
			}
			return Promise.resolve("done");
		});
		if (fail) {
			await expect(run).rejects.toThrow("stopped");
		} else {
			await expect(run).resolves.toBe("done");
		}
		expect(existsSync(generated)).toBe(false);
		expect(readdirSync(root)).toEqual(["biome.jsonc"]);
	});
});
