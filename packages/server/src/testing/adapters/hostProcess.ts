import { type ChildProcess, type ForkOptions, fork } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { Option, Schema } from "effect";

export interface HostProcessOptions {
	readonly args?: readonly string[];
	readonly cwd?: string;
	readonly env?: NodeJS.ProcessEnv;
	readonly execArgv?: readonly string[];
	readonly module: string | URL;
}

export function forkHost(options: HostProcessOptions) {
	const settings: ForkOptions = {
		cwd: options.cwd,
		env: options.env,
		execArgv: [...(options.execArgv ?? [])],
		stdio: ["ignore", "ignore", "inherit", "ipc"],
	};
	return fork(typeof options.module === "string" ? options.module : fileURLToPath(options.module), [...(options.args ?? [])], settings);
}

export function receiveHostMessage<A>(child: ChildProcess, schema: Schema.Codec<A>, signal: AbortSignal, action?: () => void) {
	return new Promise<A>((resolve, reject) => {
		function cleanup() {
			child.off("message", message);
			child.off("exit", exited);
			child.off("error", failed);
			signal.removeEventListener("abort", aborted);
		}
		function failed(cause: unknown) {
			cleanup();
			reject(cause);
		}
		function exited(code: number | null, delivered: NodeJS.Signals | null) {
			failed(new Error(`Host exited (${delivered ?? code}) before IPC acknowledgement`));
		}
		function aborted() {
			failed(signal.reason);
		}
		function message(value: unknown) {
			const decoded = Schema.decodeUnknownOption(schema)(value);
			if (Option.isSome(decoded)) {
				cleanup();
				resolve(decoded.value);
			}
		}
		child.on("message", message);
		child.once("exit", exited);
		child.once("error", failed);
		signal.addEventListener("abort", aborted, { once: true });
		if (signal.aborted) {
			aborted();
		} else if (child.exitCode !== null || child.signalCode !== null) {
			exited(child.exitCode, child.signalCode);
		} else {
			try {
				action?.();
			} catch (cause) {
				failed(cause);
			}
		}
	});
}

export function stopHost(child: ChildProcess) {
	if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) {
		return Promise.resolve();
	}
	return new Promise<void>((resolve) => {
		child.once("exit", () => resolve());
		child.kill("SIGKILL");
	});
}

export function sendHostMessage(message: unknown) {
	return new Promise<void>((resolve, reject) => {
		if (process.send === undefined) {
			reject(new Error("Host process needs a parent IPC channel"));
			return;
		}
		process.send(message, (error) => (error === null ? resolve() : reject(error)));
	});
}

export async function hostResponse(url: string, path: string, signal: AbortSignal) {
	const response = await fetch(new URL(path, url), { redirect: "manual", signal });
	return { body: await response.text(), headers: Object.fromEntries(response.headers), status: response.status };
}
