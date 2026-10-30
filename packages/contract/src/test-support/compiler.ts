import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const packageDirectory = fileURLToPath(new URL("../..", import.meta.url));

function compile(arguments_: readonly string[]) {
	return spawnSync(join(packageDirectory, "node_modules", ".bin", "tsc"), arguments_, { cwd: packageDirectory, encoding: "utf8" });
}

export const compiler = {
	declarations() {
		const output = mkdtempSync(join(tmpdir(), "contract-"));
		try {
			const result = compile(["-p", "src/test-support/fixtures/tsconfig.json", "--outDir", output]);
			const declaration = result.status === 0 ? readFileSync(join(output, "src/test-support/fixtures/valid.d.ts"), "utf8") : "";
			return { declaration, result };
		} finally {
			rmSync(output, { force: true, recursive: true });
		}
	},
	invalid() {
		const fixtures = readdirSync(join(packageDirectory, "src/test-support/fixtures/invalid")).map((file) => file.replace(/\.ts$/u, ""));
		return compile([
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
			...fixtures.map((fixture) => `src/test-support/fixtures/invalid/${fixture}.ts`),
		]);
	},
};
