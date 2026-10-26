import { fork } from "node:child_process";
import { once } from "node:events";
import { setTimeout } from "node:timers/promises";
import { Clock, Effect, Schema } from "effect";
import { type Configuration, Response } from "./processProtocol.ts";

export async function until(check: () => boolean) {
	const deadline = (await Effect.runPromise(Clock.currentTimeMillis)) + 10_000;
	while (!check()) {
		if ((await Effect.runPromise(Clock.currentTimeMillis)) > deadline) {
			throw new Error("Timed out waiting for process delivery");
		}
		await setTimeout(10);
	}
}

export async function startProcess(configuration: Configuration) {
	const child = fork(new URL("./process.ts", import.meta.url), [JSON.stringify(configuration)], {
		execArgv: ["--conditions=source"],
		stdio: ["ignore", "pipe", "pipe", "ipc"],
	});
	const responses: Response[] = [];
	let failure = "";
	child.stdout?.resume();
	child.stderr?.on("data", (data) => {
		failure += String(data);
	});
	child.on("message", (message) => responses.push(Schema.decodeUnknownSync(Response)(message)));
	child.on("exit", (code) => {
		if (code !== 0) {
			failure += `Process exited with ${code}`;
		}
	});
	async function wait(tag: Response["_tag"], previous = 0) {
		await until(() => {
			const reported = responses.find((response) => response._tag === "Failure");
			if (reported?._tag === "Failure") {
				throw new Error(reported.message);
			}
			if (failure) {
				throw new Error(failure);
			}
			return responses.filter((response) => response._tag === tag).length > previous;
		});
		return responses.find((response) => response._tag === tag);
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
		const ready = await wait("Ready");
		if (ready?._tag !== "Ready") {
			throw new Error("Process did not become ready");
		}
		return { child, close, responses, url: ready.url, wait };
	} catch (error) {
		child.kill("SIGKILL");
		throw error;
	}
}
