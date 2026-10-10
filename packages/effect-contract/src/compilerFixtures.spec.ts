import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const compilerTimeout = 60_000;
const packageDirectory = fileURLToPath(new URL("..", import.meta.url));

function compile(arguments_: readonly string[]) {
	return spawnSync(join(packageDirectory, "node_modules", ".bin", "tsc"), arguments_, { cwd: packageDirectory, encoding: "utf8" });
}

const invalidFixtures = {
	"command-query": "Property 'query' does not exist",
	"duplicate-command": "Operation names must be unique; duplicated: save",
	"duplicate-name": "Operation names must be unique; duplicated: same",
	"duplicate-query": "Operation names must be unique; duplicated: get",
	"field-rejection": `Type '"body"' is not assignable to type '"title"'`,
	"handler-mismatch": "missing the following properties from type 'Note': body, title",
	"incompatibleClient": "is not assignable",
	"incompatibleErrors": "is not assignable",
	"incompleteClient": "is not assignable",
	"inline-reject": "Property 'Anything' does not exist",
	"inline-success": "Type 'number' is not assignable to type 'void",
	"invalidates-result": "Property 'missing' does not exist on type 'Note'",
	"key-id": "Argument of type 'string' is not assignable to parameter of type 'number'",
	"reads-payload": "Property 'slug' does not exist on type '{ readonly id: number; }'",
	"rejection-tag": "must have that _tag",
	"undeclared-rejection": "Property 'id' is missing in type 'Other' but required in type 'NoteMissing'",
	"unknown-reject": "Property 'Other' does not exist",
	"wrong-payload": "Type 'string' is not assignable to type 'number'",
	"zero-rejections": "Property 'members' does not exist on type 'Never'",
} as const;

const invalidArguments = [
	"--ignoreConfig",
	"--noEmit",
	"--noErrorTruncation",
	"--pretty",
	"false",
	"--strict",
	"--skipLibCheck",
	"--target",
	"ESNext",
	"--module",
	"ESNext",
	"--moduleResolution",
	"Bundler",
	"--allowImportingTsExtensions",
	"--customConditions",
	"source",
	...Object.keys(invalidFixtures).map((fixture) => `src/test-support/fixtures/invalid/${fixture}.ts`),
];

describe("contract compiler fixtures", { timeout: compilerTimeout }, () => {
	it("accepts the valid contract, binding and handlers", () => {
		const output = mkdtempSync(join(tmpdir(), "effect-contract-"));
		try {
			const result = compile(["-p", "src/test-support/fixtures/tsconfig.json", "--outDir", output]);
			expect(result.stderr || result.stdout).toBe("");
			expect(result.status).toBe(0);
			const declaration = readFileSync(join(output, "src/test-support/fixtures/valid.d.ts"), "utf8");
			expect(declaration).toContain('api: import("#bind.ts").Bound<"notes"');
			expect(declaration).toContain('Rpc<"notes.rename"');
		} finally {
			rmSync(output, { force: true, recursive: true });
		}
	});

	it("rejects each invalid use with a specific diagnostic", () => {
		const result = compile(invalidArguments);
		const diagnostics = (result.stderr || result.stdout).split(/(?=^src\/test-support\/fixtures\/invalid\/)/mu);
		expect(result.status).not.toBe(0);
		for (const [fixture, expected] of Object.entries(invalidFixtures)) {
			const found = diagnostics.filter((message) => message.startsWith(`src/test-support/fixtures/invalid/${fixture}.ts(`)).join("\n");
			expect(found, fixture).toContain(expected);
		}
	});
});
