import { expect } from "vitest";
import { exportsStory, filePathExports, workspaceWithExports } from "#exports-story";
import { CLI_EXIT } from "#test/cli.ts";

for (const [name, exports] of [
	["a string target", "./dist/index.js"],
	["an array of targets", ["./dist/index.js"]],
	["a null exports field", null],
] as const) {
	exportsStory.it(`rejects ${name} instead of a subpath map`, [workspaceWithExports(exports)], function* ({ lint, writesExports }) {
		const result = yield* lint();
		expect(result.status).toBe(CLI_EXIT.rejected);
		expect(result.stdout).toContain("The exports field must be a subpath map.");
		yield* writesExports(filePathExports);
		expect((yield* lint()).status).toBe(CLI_EXIT.passed);
	});
}

for (const [name, key, value] of [
	["a key without a relative prefix", "*.ts", { default: "./dist/*.js", source: "./src/*.ts", types: "./dist/*.d.ts" }],
	["a non-TypeScript wildcard", "./*.js", { default: "./dist/*.js", source: "./src/*.js", types: "./dist/*.d.ts" }],
	["multiple stars in one pattern", "./**/*.ts", { default: "./dist/**/*.js", source: "./src/**/*.ts", types: "./dist/**/*.d.ts" }],
	["a wildcard without conditions", "./*.ts", "./src/*.ts"],
	["an extra condition", "./*.ts", { default: "./dist/*.js", node: "./dist/*.js", source: "./src/*.ts", types: "./dist/*.d.ts" }],
	["a missing condition", "./*.ts", { default: "./dist/*.js", source: "./src/*.ts" }],
	["a flattened source target", "./*.ts", { default: "./dist/*.js", source: "./src/server/*.ts", types: "./dist/*.d.ts" }],
	["a flattened declaration target", "./*.ts", { default: "./dist/*.js", source: "./src/*.ts", types: "./dist/server/*.d.ts" }],
	["a flattened runtime target", "./*.ts", { default: "./dist/server/*.js", source: "./src/*.ts", types: "./dist/*.d.ts" }],
] as const) {
	exportsStory.it(`rejects ${name}`, [workspaceWithExports({ [key]: value })], function* ({ lint, writesExports }) {
		const result = yield* lint();
		expect(result.status).toBe(CLI_EXIT.rejected);
		expect(result.stdout).toContain(`Export "${key}" does not preserve the module's file path.`);
		yield* writesExports(filePathExports);
		expect((yield* lint()).status).toBe(CLI_EXIT.passed);
	});
}

for (const [name, key, value] of [
	["an asset alias", "./preset.json", "./biome/preset.json"],
	["an extensionless per-file entry", "./license", "./license"],
	["a code file exposed as an asset", "./module.js", "./module.js"],
] as const) {
	exportsStory.it(`rejects ${name}`, [workspaceWithExports({ ...filePathExports, [key]: value })], function* ({ lint, writesExports }) {
		const result = yield* lint();
		expect(result.status).toBe(CLI_EXIT.rejected);
		expect(result.stdout).toContain(`Export "${key}" does not preserve the module's file path.`);
		yield* writesExports(filePathExports);
		expect((yield* lint()).status).toBe(CLI_EXIT.passed);
	});
}
