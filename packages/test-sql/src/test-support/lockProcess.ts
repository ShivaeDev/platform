import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Effect, Redacted, Schema } from "effect";

export const lockProcess = Effect.fn("LockStory.lockProcess")(function* (url: Redacted.Redacted<string>, key: string, applicationName: string) {
	const target = new URL(Redacted.value(url));
	target.searchParams.set("application_name", applicationName);
	const child = yield* Effect.acquireRelease(
		Effect.sync(() =>
			fork(fileURLToPath(new URL("./lockProcessChild.ts", import.meta.url)), [], {
				env: { "DATABASE_URL": target.toString(), "LOCK_KEY": key },
				execArgv: ["--conditions=source"],
				stdio: ["ignore", "ignore", "inherit", "ipc"],
			}),
		),
		(running) =>
			Effect.promise(
				() =>
					new Promise<void>((resolve) => {
						if (running.exitCode !== null || running.signalCode !== null) {
							resolve();
						} else {
							running.once("exit", () => resolve());
							running.kill();
						}
					}),
			),
	);
	const pid = yield* Effect.callback<unknown, Error>((resume) => {
		child.once("message", (message) => resume(Effect.succeed(message)));
		child.once("error", (error) => resume(Effect.fail(error)));
		child.once("exit", (code) => resume(Effect.fail(new Error(`Lock process exited with code ${code}`))));
	}).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Schema.Number)), Effect.timeout("5 seconds"));
	return { pid, take: Effect.sync(() => child.send("take")) };
});
