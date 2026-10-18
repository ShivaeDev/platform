import { spawnSync } from "node:child_process";

export function startTime(pid: number): string {
	const result = spawnSync("ps", ["-o", "lstart=", "-p", String(pid)], {
		encoding: "utf8",
		env: { "LC_ALL": "C", "PATH": "/usr/bin:/bin" },
	});
	if (result.error || result.status !== 0 || result.stdout.trim() === "") {
		throw new Error(`Could not observe process ${pid} with C-locale ps.`, { cause: result.error ?? result.stderr });
	}
	return result.stdout.trim();
}
