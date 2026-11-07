import { fork } from "node:child_process";
import { once } from "node:events";
import { Schema } from "effect";
import { type Configuration, Response } from "#test/postgres-example/processProtocol.ts";
import { recorded } from "#test/postgres-example/recorded.ts";

export async function startProcess(configuration: Configuration) {
	const child = fork(new URL("./process.ts", import.meta.url), [JSON.stringify(configuration)], {
		execArgv: ["--conditions=@shivaedev/source"],
		stdio: ["ignore", "pipe", "pipe", "ipc"],
	});
	const responses = recorded<Response>();
	let output = "";
	child.stdout?.resume();
	child.stderr?.on("data", (data) => {
		output += String(data);
	});
	child.on("message", (message) => {
		const response = Schema.decodeUnknownSync(Response)(message);
		if (response._tag === "Failure") {
			responses.fail(new Error(response.message));
		}
		responses.push(response);
	});
	child.on("exit", (code) => responses.fail(new Error(output || `Process exited with ${code}`)));
	function count(tag: Response["_tag"]) {
		return responses.items.filter((response) => response._tag === tag).length;
	}
	async function next(tag: Response["_tag"]) {
		const previous = count(tag);
		await responses.when(() => count(tag) > previous);
	}
	async function send(message: Parameters<typeof child.send>[0], answer: Response["_tag"]) {
		const answered = next(answer);
		child.send(message);
		await answered;
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
		await responses.when(() => count("Ready") > 0);
		const ready = responses.items.find((response) => response._tag === "Ready");
		if (ready?._tag !== "Ready") {
			throw new Error("Process did not become ready");
		}
		return { child, close, next, responses, send, url: ready.url };
	} catch (error) {
		child.kill("SIGKILL");
		throw error;
	}
}
