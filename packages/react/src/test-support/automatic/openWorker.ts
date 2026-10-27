import { fork } from "node:child_process";
import { once } from "node:events";
import { dirname, join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { Clock, Effect, Schema } from "effect";

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
	const responses: (typeof Response.Type)[] = [];
	let failure = "";
	child.stdout?.resume();
	child.stderr?.on("data", (data) => {
		failure += String(data);
	});
	child.on("message", (message) => responses.push(Schema.decodeUnknownSync(Response)(message)));
	async function wait(tag: "Ready" | "Handled", previous = 0) {
		const deadline = Effect.runSync(Clock.currentTimeMillis) + 10_000;
		while (responses.filter((response) => response._tag === tag).length <= previous) {
			const error = responses.find((response) => response._tag === "Failure");
			if (error?._tag === "Failure") {
				throw new Error(error.message);
			}
			if (failure || child.exitCode !== null || Effect.runSync(Clock.currentTimeMillis) > deadline) {
				throw new Error(failure || "Worker did not respond");
			}
			await setTimeout(10);
		}
		return responses.filter((response) => response._tag === tag).at(-1);
	}
	async function close() {
		if (child.exitCode !== null) {
			return;
		}
		const exited = once(child, "exit");
		child.send({ _tag: "Close" });
		const timer = globalThis.setTimeout(() => child.kill("SIGKILL"), 5000);
		try {
			await exited;
		} finally {
			clearTimeout(timer);
		}
	}
	try {
		await wait("Ready");
	} catch (error) {
		child.kill("SIGKILL");
		throw error;
	}
	return {
		close,
		write: (id: number, title: string, rollback = false) => {
			const previous = responses.filter((response) => response._tag === "Handled").length;
			child.send({ _tag: "Write", work: { id, rollback, title } });
			return wait("Handled", previous);
		},
	};
}
