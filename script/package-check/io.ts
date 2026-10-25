import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Config, Effect, FileSystem } from "effect";

const execute = promisify(execFile);
export const command = Effect.fn("Packed.command")(function* (cwd: string, executable: string, args: readonly string[]) {
	const count = yield* Config.Int("GIT_CONFIG_COUNT").pipe(Config.withDefault(0));
	// A generated app's initial commit must not leave detached packers racing scoped cleanup.
	const environment = [
		`GIT_CONFIG_COUNT=${count + 2}`,
		`GIT_CONFIG_KEY_${count}=gc.auto`,
		`GIT_CONFIG_VALUE_${count}=0`,
		`GIT_CONFIG_KEY_${count + 1}=maintenance.auto`,
		`GIT_CONFIG_VALUE_${count + 1}=false`,
	];
	return yield* Effect.tryPromise({
		catch: (cause) =>
			new Error(
				`${executable} ${args.join(" ")} failed in ${cwd}: ${String(cause)}${typeof cause === "object" && cause !== null && "stdout" in cause ? `\n${cause.stdout}` : ""}`,
				{ cause },
			),
		try: (signal) =>
			execute("env", [...environment, executable, ...args], {
				cwd,
				encoding: "utf8",
				maxBuffer: 16 * 1024 * 1024,
				signal,
				timeout: 180_000,
			}),
	}).pipe(Effect.map(({ stdout }) => stdout));
});
export function writeJson(path: string, value: unknown) {
	return Effect.flatMap(FileSystem.FileSystem, (fs) => fs.writeFileString(path, `${JSON.stringify(value, null, 2)}\n`));
}
export function requireThat(condition: boolean, message: string) {
	return condition ? Effect.void : Effect.fail(new Error(message));
}
