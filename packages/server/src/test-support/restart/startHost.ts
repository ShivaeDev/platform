import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Effect, Schema } from "effect";

const Ready = Schema.Struct({ pid: Schema.Number, port: Schema.Number });
export function startHost(port = 0) {
	return Effect.acquireRelease(
		Effect.promise(async () => {
			const child = fork(fileURLToPath(new URL("./process.ts", import.meta.url)), [String(port)], {
				execArgv: ["--conditions=source"],
				stdio: ["ignore", "ignore", "pipe", "ipc"],
			});
			let stderr = "";
			child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
				stderr += chunk;
			});
			const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
			const ready = new Promise<typeof Ready.Type>((resolve, reject) => {
				child.once("error", reject);
				child.once("exit", (code) => reject(new Error(`Restart host exited (${code}): ${stderr}`)));
				child.once("message", (message) => {
					try {
						resolve(Schema.decodeUnknownSync(Ready)(message));
					} catch (error) {
						reject(error);
					}
				});
			});
			const address = await ready;
			return {
				...address,
				stop: async () => {
					child.kill("SIGKILL");
					await exited;
				},
			};
		}),
		(host) => Effect.promise(host.stop),
	);
}
