import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Cause, Effect } from "effect";
import { changeSignal } from "#test/changeSignal.ts";

function diagnose(effect: Effect.Effect<void, unknown>, message: () => string) {
	return effect.pipe(
		Effect.catchCause((cause) => Effect.failCause(Cause.hasInterruptsOnly(cause) ? cause : Cause.combine(cause, Cause.die(new Error(message()))))),
	);
}

export function hostProcess(configFile: string, pausePublication = false, report = false, entry = new URL("./cloudHostProcess.ts", import.meta.url)) {
	return Effect.acquireRelease(
		Effect.sync(() => {
			const changed = changeSignal();
			const child = spawn(
				process.execPath,
				["--conditions=source", fileURLToPath(entry), configFile, ...(pausePublication ? ["pause-publication"] : []), ...(report ? ["report"] : [])],
				{
					stdio: ["ignore", "pipe", "pipe", "ipc"],
				},
			);
			const ready = Promise.withResolvers<string>();
			const publication = Promise.withResolvers<void>();
			child.on("message", (notification) => {
				changed.notify();
				if (notification === "published") {
					publication.resolve();
				}
			});
			let url: string | undefined;
			let output = "";
			child.stdout?.on("data", (chunk: Buffer) => {
				output = `${output}${chunk.toString()}`.slice(-8192);
				changed.notify();
				url = output.match(/http:\/\/127\.0\.0\.1:\d+(?=\s)/u)?.[0] ?? url;
				if (url !== undefined) {
					ready.resolve(url);
				}
			});
			let errors = "";
			let status = "running";
			child.stderr?.on("data", (chunk: Buffer) => {
				errors += chunk.toString();
				changed.notify();
			});
			const closed = new Promise<void>((resolve) => {
				child.once("error", (error) => {
					status = `spawn failed: ${error.message}`;
					changed.notify();
					resolve();
				});
				child.once("close", (code, signal) => {
					status = `exited (code ${code}, signal ${signal})`;
					changed.notify();
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
			function until(condition: () => Effect.Effect<boolean | { readonly done: boolean }, unknown>) {
				const read = Effect.suspend(() => (status === "running" ? condition() : Effect.die(new Error(`Host ${status}`))));
				return diagnose(changed.wait(read, (observed) => (typeof observed === "boolean" ? observed : observed.done)).pipe(Effect.asVoid), message);
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
				published: Effect.promise(() => publication.promise).pipe(Effect.timeout("15 seconds")),
				ready: Effect.promise(() => ready.promise).pipe(Effect.timeout("15 seconds")),
				until,
				get url() {
					return url;
				},
			};
		}),
		(child) => child.close,
	);
}
