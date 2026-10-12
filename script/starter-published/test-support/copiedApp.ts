import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";
import { decodeVersions } from "#package-check/model.ts";
import { copyStarter } from "#starter-published/copy.ts";

export async function copiedApp() {
	const temporary = mkdtempSync(join(tmpdir(), "starter-copy-"));
	const consumer = join(temporary, "app");
	function remove() {
		rmSync(temporary, { force: true, recursive: true });
	}
	try {
		const versions = decodeVersions(readFileSync("examples/starter/published-versions.json", "utf8"));
		await Effect.runPromise(copyStarter(process.cwd(), consumer, versions).pipe(Effect.provide(NodeFileSystem.layer)));
		return { consumer, remove, versions };
	} catch (error) {
		remove();
		throw error;
	}
}
