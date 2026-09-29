import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Effect, FileSystem } from "effect";

const execute = promisify(execFile);
export const command = (cwd: string, executable: string, args: readonly string[]) =>
	Effect.tryPromise({
		try: (signal) => execute(executable, args, { signal, cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, timeout: 180_000 }),
		catch: (cause) =>
			new Error(
				`${executable} ${args.join(" ")} failed in ${cwd}: ${String(cause)}${typeof cause === "object" && cause !== null && "stdout" in cause ? `\n${cause.stdout}` : ""}`,
				{ cause },
			),
	}).pipe(Effect.map(({ stdout }) => stdout));
export const writeJson = (path: string, value: unknown) =>
	Effect.flatMap(FileSystem.FileSystem, (fs) => fs.writeFileString(path, `${JSON.stringify(value, null, 2)}\n`));
export const requireThat = (condition: boolean, message: string) => (condition ? Effect.void : Effect.fail(new Error(message)));
