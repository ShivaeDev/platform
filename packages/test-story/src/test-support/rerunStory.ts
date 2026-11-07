import { execFileSync } from "node:child_process";
import { basename, dirname, resolve } from "node:path";
import { runStories } from "#test/runStories.ts";

export function rerunStory(report: string) {
	const command = report.slice(report.lastIndexOf("Rerun: ") + "Rerun: ".length);
	const [run, file, filter, pattern, ...rest] = execFileSync("/bin/sh", ["-c", `vitest() { printf '%s\\0' "$@"; }\n${command}`], {
		encoding: "utf8",
	})
		.split("\0")
		.slice(0, -1);
	if (run !== "run" || file === undefined || filter !== "-t" || pattern === undefined || rest.length > 0) {
		throw new Error("The rerun command did not pass a file and test filter to vitest.");
	}
	return runStories({ include: basename(file), root: dirname(resolve(file)), testNamePattern: pattern });
}
