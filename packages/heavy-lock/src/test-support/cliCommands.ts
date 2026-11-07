import process from "node:process";
import { fileURLToPath } from "node:url";
import { CLI_ARGUMENTS } from "#test/cliProcess.ts";

export function cliEnvironment(lock: string, extra: Record<string, string> = {}): Record<string, string> {
	return {
		"HEAVY_PROCESS_LOCK": lock,
		"PATH": "/usr/bin:/bin",
		...extra,
	};
}

export type CommandLine = readonly [string, ...string[]];

function shell(script: string): CommandLine {
	return ["/bin/sh", "-c", `echo running; ${script}`];
}

export const commands = {
	blocksRelease: shell('rm "$HEAVY_PROCESS_LOCK"; mkdir "$HEAVY_PROCESS_LOCK"'),
	exitsWith: (code: number) => shell(`exit ${code}`),
	holdsUntilReleased: shell("read line"),
	killsItselfWith: (signal: NodeJS.Signals) => shell(`kill -${signal.slice(3)} $$`),
	nestedRunOf: (command: CommandLine): CommandLine => [process.execPath, ...CLI_ARGUMENTS, "--", ...command],
	printsToStderr: (line: string) => shell(`echo '${line}' >&2`),
	reportsArguments: (...args: readonly string[]): CommandLine => [...shell('printf "%s\\n" "$@"'), "check", ...args],
	reportsHolderId: shell(
		'printf "holder id=%s\\nlock=%s\\nlock path=%s\\n" "$HEAVY_PROCESS_LOCK_ID" "$(cat "$HEAVY_PROCESS_LOCK" 2>/dev/null)" "$HEAVY_PROCESS_LOCK"',
	),
	reportsProcessGroup: shell('if [ "$(ps -o pgid= -p $$ | tr -d " ")" = "$$" ]; then echo "leads its process group"; fi'),
	trapsAndExits: (signal: NodeJS.Signals, code: number): CommandLine => [
		"/bin/sh",
		"-c",
		`trap 'exit ${code}' ${signal.slice(3)}; echo running; read line; exit 1`,
	],
	withSignalAcknowledgingDescendant: (signal: NodeJS.Signals): CommandLine => [
		process.execPath,
		fileURLToPath(new URL("./signalDescendant.ts", import.meta.url)),
		signal,
	],
};
