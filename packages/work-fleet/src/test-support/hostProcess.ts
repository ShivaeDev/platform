import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Cause, Effect } from "effect";
import { until } from "#test/cloudRestart.ts";

function diagnose(effect: Effect.Effect<void, unknown>, message: () => string) {
	return effect.pipe(
		Effect.catchCause((cause) => Effect.failCause(Cause.hasInterruptsOnly(cause) ? cause : Cause.combine(cause, Cause.die(new Error(message()))))),
	);
}

export function hostProcess(configFile: string, daemon = false) {
	return Effect.acquireRelease(
		Effect.sync(() => {
			const child = spawn(
				process.execPath,
				["--conditions=source", fileURLToPath(new URL("./cloudHostProcess.ts", import.meta.url)), configFile, ...(daemon ? ["daemon"] : [])],
				{
					stdio: ["ignore", "pipe", "pipe"],
				},
			);
			let url: string | undefined;
			let output = "";
			child.stdout.on("data", (chunk: Buffer) => {
				output = `${output}${chunk.toString()}`.slice(-8192);
				url = output.match(/http:\/\/127\.0\.0\.1:\d+(?=\s)/u)?.[0] ?? url;
			});
			let errors = "";
			let status = "running";
			child.stderr.on("data", (chunk: Buffer) => {
				errors += chunk.toString();
			});
			const closed = new Promise<void>((resolve) => {
				child.once("error", (error) => {
					status = `spawn failed: ${error.message}`;
					resolve();
				});
				child.once("close", (code, signal) => {
					status = `exited (code ${code}, signal ${signal})`;
					resolve();
				});
			});
			const close = Effect.promise(async () => {
				child.kill("SIGKILL");
				await closed;
			});
			function message() {
				return `Host ${status}\nHost stderr:\n${errors || "(empty)"}`;
			}
			return {
				close,
				kill: diagnose(
					close.pipe(
						Effect.flatMap(() =>
							status === "exited (code null, signal SIGKILL)" ? Effect.void : Effect.die(new Error("Host did not exit from SIGKILL")),
						),
					),
					message,
				),
				until: (condition: Parameters<typeof until>[0]) =>
					diagnose(
						until(() => Effect.suspend(() => (status === "running" ? condition() : Effect.die(new Error(`Host ${status}`))))),
						message,
					),
				get url() {
					return url;
				},
			};
		}),
		(child) => child.close,
	);
}
