import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TrimCheck {
	memoryBytes: number;
	timeSeconds: number;
}

export function runTrimShell(command: string, checks: TrimCheck[]) {
	const directory = mkdtempSync(join(tmpdir(), "postgres-trim-"));
	function script(name: string, body: string) {
		const path = join(directory, name);
		writeFileSync(path, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
		return path;
	}
	try {
		writeFileSync(join(directory, "step"), "0");
		writeFileSync(join(directory, "memory"), checks.map(({ memoryBytes }) => memoryBytes).join("\n"));
		writeFileSync(join(directory, "times"), checks.map(({ timeSeconds }) => timeSeconds).join("\n"));
		writeFileSync(join(directory, "calls"), "");
		execFileSync("mkdir", [join(directory, "pgdata")]);
		writeFileSync(join(directory, "pgdata", "table with spaces"), "data");
		writeFileSync(join(directory, "pgdata", "index"), "data");
		execFileSync("mkfifo", [join(directory, "done")]);
		script(
			"sleep",
			`step=$(( $(/bin/cat "$TRIM_DIRECTORY/step") + 1 )); echo "$step" > "$TRIM_DIRECTORY/step"
if [ "$step" -gt ${checks.length} ]; then echo done > "$TRIM_DIRECTORY/done"; exit 1; fi
echo "$1" >> "$TRIM_DIRECTORY/intervals"`,
		);
		script("date", 'sed -n "$(/bin/cat "$TRIM_DIRECTORY/step")p" "$TRIM_DIRECTORY/times"');
		script(
			"cat",
			'if [ "$1" = /sys/fs/cgroup/memory.current ]; then sed -n "$(/bin/cat "$TRIM_DIRECTORY/step")p" "$TRIM_DIRECTORY/memory"; else exec /bin/cat "$@"; fi',
		);
		script("dd", 'printf "%s:%s\\n" "$(/bin/cat "$TRIM_DIRECTORY/step")" "$*" >> "$TRIM_DIRECTORY/calls"');
		const tini = script("tini", 'printf "%s\\n" "$@" > "$TRIM_DIRECTORY/startup"; read -r result < "$TRIM_DIRECTORY/done"');
		execFileSync("/bin/sh", ["-c", command.replace('"/usr/bin/tini"', `"${tini}"`)], {
			env: {
				"PATH": `${directory}:/usr/bin:/bin`,
				"PGDATA": join(directory, "pgdata"),
				"TRIM_DIRECTORY": directory,
			},
			timeout: 5000,
		});
		return {
			calls: readFileSync(join(directory, "calls"), "utf8").replaceAll(`${directory}/pgdata/`, "").trim().split("\n").filter(Boolean).sort(),
			intervals: readFileSync(join(directory, "intervals"), "utf8").trim().split("\n").map(Number),
			startup: readFileSync(join(directory, "startup"), "utf8").trim().split("\n"),
		};
	} finally {
		rmSync(directory, { force: true, recursive: true });
	}
}
