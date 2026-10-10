import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const directories: string[] = [];
const cli = fileURLToPath(import.meta.resolve("#bin/normalize-contract.ts"));

export function generatedContractFile(source: string): string {
	const directory = mkdtempSync(join(tmpdir(), "contract-normalization-"));
	directories.push(directory);
	const path = join(directory, "contract.d.ts");
	writeFileSync(path, source);
	return path;
}

export function runNormalizeContract(arguments_: readonly string[]) {
	return spawnSync(process.execPath, ["--conditions=source", cli, ...arguments_], { encoding: "utf8" });
}

export function removeGeneratedContractFiles(): void {
	for (const directory of directories.splice(0)) {
		rmSync(directory, { force: true, recursive: true });
	}
}
