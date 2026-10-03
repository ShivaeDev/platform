import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { afterEach, expect, it } from "vitest";

const directories: string[] = [];
const cli = fileURLToPath(new URL("../src/bin/normalize-contract.ts", import.meta.url));
const contract = (source: string) => {
	const directory = mkdtempSync(join(tmpdir(), "contract-normalization-"));
	directories.push(directory);
	const path = join(directory, "contract.d.ts");
	writeFileSync(path, source);
	return path;
};
const normalize = (path: string) => spawnSync(process.execPath, [cli, path], { encoding: "utf8" });
afterEach(() => {
	for (const directory of directories.splice(0)) {
		rmSync(directory, { force: true, recursive: true });
	}
});

it("normalizes generated timestamps, preserves other fields and can run twice", () => {
	const path = contract(
		[
			"readonly createdAt: Timestamp<6>;",
			"readonly verifiedAt: Timestamptz<3> | null;",
			"readonly deletedAt: Timestamp<undefined>;",
			"readonly output: CodecTypes['pg/timestamp@1']['output'];",
			"readonly input: CodecTypes['pg/timestamptz@1']['input'];",
			"readonly email: string;",
		].join("\n"),
	);
	const expected = [
		"readonly createdAt: Date;",
		"readonly verifiedAt: Date | null;",
		"readonly deletedAt: Date;",
		"readonly output: Date;",
		"readonly input: Date;",
		"readonly email: string;",
	].join("\n");
	for (let run = 0; run < 2; run++) {
		const result = normalize(path);
		expect({ status: result.status, stderr: result.stderr }).toEqual({ status: 0, stderr: "" });
		expect(readFileSync(path, "utf8")).toBe(expected);
	}
});

it("refuses unsupported timestamp declarations without overwriting the generated file", () => {
	const source = "readonly createdAt: Timestamp<Precision>;";
	const path = contract(source);
	const result = normalize(path);
	expect(result.status).toBe(1);
	expect(result.stderr).toContain("Unsupported Prisma Next timestamp declaration");
	expect(readFileSync(path, "utf8")).toBe(source);
});
