import { spawn } from "node:child_process";
import { Context } from "effect";

export interface LineProcess {
	readonly kill: () => void;
	readonly onExit: (listener: (code: number | null) => void) => void;
	readonly onLine: (listener: (line: string) => void) => void;
	readonly onStderr: (listener: (text: string) => void) => void;
	readonly write: (line: string) => void;
}

interface SpawnLineProcessOptions {
	readonly args: readonly string[];
	readonly command: string;
	readonly cwd: string;
}

export const ProcessSpawner = Context.Reference("@shivaedev/agent-codex/ProcessSpawner", {
	defaultValue: () => ({ spawn: spawnLineProcess }),
});

// Codex app-server uses newline-delimited JSON over stdio.
export function spawnLineProcess(options: SpawnLineProcessOptions): LineProcess {
	const child = spawn(options.command, [...options.args], {
		cwd: options.cwd,
		stdio: ["pipe", "pipe", "pipe"],
	});
	let lineListener: ((line: string) => void) | null = null;
	let stderrListener: ((text: string) => void) | null = null;
	const exitListeners: ((code: number | null) => void)[] = [];
	function emitExit(code: number | null): void {
		for (const listener of exitListeners) {
			listener(code);
		}
	}
	let buffer = "";
	child.stdout.setEncoding("utf8");
	child.stdout.on("data", (chunk: string) => {
		buffer += chunk;
		let newline = buffer.indexOf("\n");
		while (newline >= 0) {
			const line = buffer.slice(0, newline).trim();
			buffer = buffer.slice(newline + 1);
			if (line.length > 0) {
				lineListener?.(line);
			}
			newline = buffer.indexOf("\n");
		}
	});
	child.stderr.setEncoding("utf8");
	child.stderr.on("data", (chunk: string) => stderrListener?.(chunk));
	child.on("exit", (code) => emitExit(code));
	child.on("error", () => emitExit(null));
	child.stdin.on("error", () => emitExit(null));
	return {
		// Closing stdin lets app-server exit cleanly; SIGTERM handles a child that remains alive.
		kill: () => {
			child.stdin.end();
			child.kill("SIGTERM");
		},
		onExit: (listener) => {
			exitListeners.push(listener);
		},
		onLine: (listener) => {
			lineListener = listener;
		},
		onStderr: (listener) => {
			stderrListener = listener;
		},
		write: (line) => {
			child.stdin.write(`${line}\n`);
		},
	};
}
