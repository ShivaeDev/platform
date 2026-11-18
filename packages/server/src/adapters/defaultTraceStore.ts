import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { Effect } from "effect";

export const defaultTraceStore = Effect.sync(() => {
	const workingDirectory = process.cwd();
	const installed = join(workingDirectory, "node_modules");
	if (existsSync(installed)) {
		return { path: join(installed, ".cache", "@shivaedev", "server", "traces.db"), temporary: false, workingDirectory };
	}
	// No node_modules folder is created here: an ignore rule anchored at a repository's root would not cover it, and the store could be committed.
	const folder = `shivaedev-server-${createHash("sha256").update(workingDirectory).digest("hex").slice(0, 12)}`;
	return { path: join(tmpdir(), folder, "traces.db"), temporary: true, workingDirectory };
});
