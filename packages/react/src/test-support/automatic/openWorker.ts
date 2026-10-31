import { fork } from "node:child_process";
import { once } from "node:events";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Schema } from "effect";

const Response = Schema.Union([
	Schema.Struct({ _tag: Schema.Literal("Ready") }),
	Schema.Struct({ _tag: Schema.Literal("Handled"), result: Schema.String }),
	Schema.Struct({ _tag: Schema.Literal("Failure"), message: Schema.String }),
]);

export async function openWorker(databaseUrl: string) {
	const child = fork(join(dirname(fileURLToPath(import.meta.url)), "worker.ts"), [JSON.stringify({ databaseUrl, schema: "automatic_jobs" })], {
		execArgv: ["--conditions=source"],
		stdio: ["ignore", "pipe", "pipe", "ipc"],
	});
	let failure = "";
	child.stdout?.resume();
	child.stderr?.on("data", (data) => {
		failure += String(data);
	});
	function next(tag: "Ready" | "Handled") {
		return new Promise<typeof Response.Type>((resolve, reject) => {
			function stop() {
				child.off("message", message);
				child.off("exit", exited);
			}
			function message(raw: unknown) {
				const response = Schema.decodeUnknownSync(Response)(raw);
				if (response._tag === "Failure") {
					stop();
					reject(new Error(response.message));
				} else if (response._tag === tag) {
					stop();
					resolve(response);
				}
			}
			function exited() {
				stop();
				reject(new Error(failure || "The worker exited"));
			}
			child.on("message", message);
			child.on("exit", exited);
		});
	}
	async function close() {
		if (child.exitCode !== null) {
			return;
		}
		const exited = once(child, "exit");
		child.send({ _tag: "Close" });
		await exited;
	}
	try {
		await next("Ready");
	} catch (error) {
		child.kill("SIGKILL");
		throw error;
	}
	return {
		close,
		write: async (id: number, title: string, rollback = false) => {
			const handled = next("Handled");
			child.send({ _tag: "Write", work: { id, rollback, title } });
			const response = await handled;
			return response._tag === "Handled" ? response.result : response._tag;
		},
	};
}
