import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

async function listedPaths(directory: string, options: readonly string[]): Promise<readonly string[]> {
	try {
		const { stdout } = await run("git", ["ls-files", "-z", ...options, "--", "."], { cwd: directory, maxBuffer: 2 ** 30 });
		return stdout
			.split("\0")
			.filter(Boolean)
			.map((path) => join(directory, path));
	} catch (error) {
		if (error instanceof Error && "stderr" in error && String(error.stderr).includes("not a git repository")) {
			return [];
		}
		throw error;
	}
}

export function trackedPaths(directory: string): Promise<readonly string[]> {
	return listedPaths(directory, []);
}

export function ignoredTrackedPaths(directory: string): Promise<readonly string[]> {
	return listedPaths(directory, ["--cached", "--ignored", "--exclude-standard"]);
}
