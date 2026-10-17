import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Effect, FileSystem } from "effect";

const execute = promisify(execFile);
export function command(cwd: string, executable: string, args: readonly string[]) {
	return Effect.tryPromise({
		catch: (cause) =>
			new Error(
				`${executable} ${args.join(" ")} failed in ${cwd}: ${String(cause)}${typeof cause === "object" && cause !== null && "stdout" in cause ? `\n${cause.stdout}` : ""}`,
				{ cause },
			),
		try: (signal) => execute(executable, args, { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, signal, timeout: 180_000 }),
	}).pipe(Effect.map(({ stdout }) => stdout));
}
export function writeJson(path: string, value: unknown) {
	return Effect.flatMap(FileSystem.FileSystem, (fs) => fs.writeFileString(path, `${JSON.stringify(value, null, 2)}\n`));
}
export function requireThat(condition: boolean, message: string) {
	return condition ? Effect.void : Effect.fail(new Error(message));
}
