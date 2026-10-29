import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parserWarning, uncoveredParser } from "#test/biomeExceptions.ts";
import {
	addUntypedParser,
	biomeFindingsRepository,
	invalidBiomeRepository,
	missingPresetRepository,
	successiveFixesRepository,
	unorderedDuplicateKeysRepository,
	untypedParserRepository,
	warningOverrideRepository,
} from "#test/biomeRepository.ts";
import { CLI_TIMEOUT, runQuality } from "#test/cli.ts";
import { removeSeededTrees } from "#test/tree.ts";

afterEach(removeSeededTrees);

describe("the biome rule", { timeout: CLI_TIMEOUT }, () => {
	it("reports each Biome finding under the shared preset as biome/<category>, at its line", async () => {
		const root = biomeFindingsRepository();
		const result = await runQuality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain("error biome/lint/suspicious/noExplicitAny (1)\n  src/parse.ts:1  Unexpected any. Specify a different type.");
		expect(result.stdout).toContain("error biome/format (1)\n  src/b.ts  Is not formatted. Run `quality fix`.");
	});

	it("takes Biome findings into the baseline per rule and file, and fails when one grows", async () => {
		const root = untypedParserRepository();
		expect(await runQuality(root, "baseline", "write")).toMatchObject({
			status: 0,
			stdout: "quality: recorded 1 entry in quality-baseline.jsonl.\n",
		});
		expect(readFileSync(join(root, "quality-baseline.jsonl"), "utf8")).toBe(
			'{"path":"src/parse.ts","rule":"biome/lint/suspicious/noExplicitAny","count":1}\n',
		);
		expect((await runQuality(root, "lint")).status).toBe(0);
		addUntypedParser(root);
		const grown = await runQuality(root, "lint");
		expect(grown.status).toBe(1);
		expect(grown.stdout).toContain("src/parse.ts is over its baseline: 2 against 1 baselined.");
	});

	it("records every Biome rule again through the biome name", async () => {
		const root = untypedParserRepository();
		expect((await runQuality(root, "baseline", "write", "--rule", "biome")).status).toBe(0);
		expect(readFileSync(join(root, "quality-baseline.jsonl"), "utf8")).toContain('"rule":"biome/lint/suspicious/noExplicitAny"');
		expect((await runQuality(root, "lint")).status).toBe(0);
	});

	it("asks for a root Biome config that extends the shared preset", async () => {
		const root = missingPresetRepository();
		const result = await runQuality(root, "lint");
		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			'error biome/preset (1)\n  biome.json  Extend "@shivaedev/quality/biome/preset.json" from the root Biome config.',
		);
	});

	it("honours a reasoned warning exception only for its declared file", async () => {
		const root = warningOverrideRepository();
		expect(await runQuality(parserWarning(root), "lint")).toMatchObject({ status: 0, stdout: "quality: passed. 1 source file checked.\n" });
		const uncovered = await runQuality(uncoveredParser(root), "lint");
		expect(uncovered.status).toBe(1);
		expect(uncovered.stdout).toContain("src/other.ts:1  Unexpected any. Specify a different type.");
		expect(uncovered.stdout).not.toContain("src/parse.ts:1  Unexpected any.");
	});

	it("exits 2 with Biome's message when Biome cannot read its config", async () => {
		const result = await runQuality(invalidBiomeRepository(), "lint");
		expect(result.status).toBe(2);
		expect(result.stderr).toContain("rule biome failed: biome check");
		expect(result.stderr).toContain("Found an unknown key `unknownKey`.");
	});
});

describe("quality fix", { timeout: CLI_TIMEOUT }, () => {
	it("formats files but leaves key order and duplicate keys for a person to decide on, and the lint still reports them", async () => {
		const root = unorderedDuplicateKeysRepository();
		expect(await runQuality(root, "fix")).toMatchObject({
			status: 0,
			stdout: [
				"quality: sort-package-json rewrote 0 manifests.",
				"quality: Biome round 1 rewrote 1 file with fixes and 0 files with the format pass.",
				"quality: Biome round 2 rewrote 0 files with fixes and 0 files with the format pass.",
				"",
			].join("\n"),
		});
		expect(readFileSync(join(root, "src/b.ts"), "utf8")).toBe("export const b = { z: 1, a: 2 };\nexport const twice = { a: 1, a: 2 };\n");
		const { stdout } = await runQuality(root, "lint");
		expect(stdout).toContain("error biome/assist/source/useSortedKeys (1)\n  src/b.ts:1  The object properties are not sorted by key.");
		expect(stdout).toContain("biome/lint/suspicious/noDuplicateObjectKeys");
	});

	it("applies unsafe fixes and repeats them until a round rewrites nothing, since one fix can make room for another", async () => {
		const root = successiveFixesRepository();
		expect(await runQuality(root, "fix")).toMatchObject({
			status: 0,
			stdout: expect.stringContaining(
				[
					"quality: Biome round 1 rewrote 1 file with fixes and 0 files with the format pass.",
					"quality: Biome round 2 rewrote 1 file with fixes and 0 files with the format pass.",
					"quality: Biome round 3 rewrote 0 files with fixes and 0 files with the format pass.",
				].join("\n"),
			),
		});
		expect(readFileSync(join(root, "src/is-a.ts"), "utf8")).toBe('export function isA(text: string): boolean {\n\treturn text.startsWith("a");\n}\n');
	});
});
