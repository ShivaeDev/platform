import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { afterEach, describe, expect, it } from "vitest";
import { quality, qualityWithin } from "#test/cli.ts";
import { nodeImportsRepository, repairsImport } from "#test/nodeImportsRepository.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("Node import checks", { timeout: 60_000 }, () => {
	it.each(["process", "globalThis.process"])("reports %s without applying its unsafe fix, and accepts the explicit import", async (reference) => {
		const content = `export const value = Number(${reference}.pid);\n`;
		const root = nodeImportsRepository(content);
		expect(await qualityWithin(30_000, root, "fix")).toMatchObject({ status: 0 });
		expect(readFileSync(join(root, "src/value.ts"), "utf8")).toBe(content);
		const result = quality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("error biome/lint/correctness/noProcessGlobal (1)\n  src/value.ts:1");
		repairsImport(root, 'import process from "node:process";\n\nexport const value = Number(process.pid);\n');
		expect(quality(root, "lint")).toMatchObject({ status: 0 });
	});

	it.each(["", ' assert { type: "json" }'])(
		"reports a JSON import with %j without changing its attributes, and accepts Node's attributes",
		async (attributes) => {
			const content = `import data from "./value.json"${attributes};\n\nexport const value = data.value;\n`;
			const root = nodeImportsRepository(content);
			expect(await qualityWithin(30_000, root, "fix")).toMatchObject({ status: 0 });
			expect(readFileSync(join(root, "src/value.ts"), "utf8")).toBe(content);
			const result = quality(root, "lint");
			expect(result.status).toBe(1);
			expect(result.stdout).toContain("error biome/lint/correctness/useJsonImportAttributes (1)\n  src/value.ts:1");
			repairsImport(root, 'import data from "./value.json" with { type: "json" };\n\nexport const value = data.value;\n');
			expect(quality(root, "lint")).toMatchObject({ status: 0 });
			const loaded = spawnSync(process.execPath, ["--input-type=module", "--eval", 'import { value } from "./src/value.ts"; console.log(value);'], {
				cwd: root,
				encoding: "utf8",
			});
			expect({ status: loaded.status, stderr: loaded.stderr, stdout: loaded.stdout }).toEqual({ status: 0, stderr: "", stdout: "1\n" });
		},
	);
});
