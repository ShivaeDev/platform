import { execFile } from "node:child_process";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

async function listedPaths(directory: string, options: readonly string[]): Promise<readonly string[] | undefined> {
	try {
		const { stdout } = await run("git", ["ls-files", "-z", ...options, "--", "."], { cwd: directory, maxBuffer: 2 ** 30 });
		return stdout
			.split("\0")
			.filter(Boolean)
			.map((path) => join(directory, path));
	} catch (error) {
		if (error instanceof Error && "stderr" in error && String(error.stderr).includes("not a git repository")) {
			return undefined;
		}
		throw error;
	}
}

export async function trackedPaths(directory: string): Promise<readonly string[]> {
	return (await listedPaths(directory, [])) ?? [];
}

export async function ignoredTrackedPaths(directory: string): Promise<readonly string[]> {
	return (await listedPaths(directory, ["--cached", "--ignored", "--exclude-standard"])) ?? [];
}

export async function ignoredPaths(directory: string): Promise<readonly string[] | undefined> {
	const paths = await listedPaths(directory, ["--others", "--ignored", "--exclude-standard", "--directory"]);
	return paths?.map((path) => resolve(path));
}
