import { type ChildProcess, spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Deferred, Effect } from "effect";

export const scriptProcess = Effect.fn("ScriptStory.scriptProcess")(function* (greeting: string | undefined) {
	const closed = yield* Deferred.make<{
		readonly code: number | null;
		readonly stdout: string;
		readonly stderr: string;
		readonly output: string;
	}>();
	const waiting = yield* Deferred.make<void>();
	let stdout = "";
	let stderr = "";
	let child: ChildProcess | undefined;
	yield* Effect.addFinalizer(() =>
		Effect.gen(function* () {
			if (child !== undefined && child.exitCode === null && child.signalCode === null) {
				child.kill("SIGKILL");
				yield* Deferred.await(closed);
			}
		}),
	);
	return {
		finished: () => Deferred.await(closed),
		interrupt: () =>
			Effect.sync(() => {
				if (child === undefined) {
					throw new Error("Start the script before interrupting it");
				}
				child.kill("SIGINT");
			}),
		start: (args: readonly string[]) =>
			Effect.sync(() => {
				child = spawn(process.execPath, ["--conditions=source", fileURLToPath(new URL("./example.ts", import.meta.url)), ...args], {
					env: { "SCRIPT_GREETING": greeting },
					stdio: ["ignore", "pipe", "pipe"],
				});
				child.stdout?.on("data", (chunk: Buffer) => {
					stdout += chunk.toString();
					if (stdout.includes("waiting for interruption\n")) {
						Deferred.doneUnsafe(waiting, Effect.void);
					}
				});
				child.stderr?.on("data", (chunk: Buffer) => {
					stderr += chunk.toString();
				});
				child.once("error", (error) => {
					Deferred.doneUnsafe(closed, Effect.die(error));
					Deferred.doneUnsafe(waiting, Effect.die(error));
				});
				child.once("close", (code) => {
					Deferred.doneUnsafe(closed, Effect.succeed({ code, output: `${stdout}${stderr}`, stderr, stdout }));
					Deferred.doneUnsafe(waiting, Effect.die(new Error(`Script exited before waiting: ${stdout}${stderr}`)));
				});
			}),
		waiting: () => Deferred.await(waiting),
	};
});
