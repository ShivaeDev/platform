import { spawn } from "node:child_process";
import process from "node:process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { Effect, Schema } from "effect";

const Response = Schema.Struct({
	error: Schema.optional(Schema.Unknown),
	id: Schema.optional(Schema.Number),
	result: Schema.optional(Schema.Unknown),
});
const Result = Schema.Struct({
	content: Schema.Array(Schema.Struct({ text: Schema.String, type: Schema.Literal("text") })),
	isError: Schema.optional(Schema.Boolean),
});

export const mcpClient = Effect.fn("Test.mcpClient")(function* (directory: string) {
	const child = yield* Effect.acquireRelease(
		Effect.sync(() =>
			spawn(process.execPath, ["--conditions=source", fileURLToPath(new URL("../server/cli.ts", import.meta.url)), "mcp", directory], {
				stdio: ["pipe", "pipe", "pipe"],
			}),
		),
		(running) =>
			Effect.promise(
				() =>
					new Promise<void>((resolve) => {
						if (running.exitCode !== null || running.signalCode !== null) {
							resolve();
							return;
						}
						running.once("exit", () => resolve());
						running.kill("SIGTERM");
					}),
			),
	);
	let nextId = 0;
	let stderr = "";
	const pending = new Map<number, { resolve: (result: unknown) => void; reject: (error: Error) => void }>();
	function rejectPending(error: Error) {
		for (const request of pending.values()) {
			request.reject(error);
		}
		pending.clear();
	}
	child.stderr.on("data", (chunk) => {
		stderr += String(chunk);
	});
	child.on("error", rejectPending);
	child.on("exit", () => rejectPending(new Error(`MCP exited: ${stderr}`)));
	const lines = createInterface({ input: child.stdout });
	lines.on("line", (line) => {
		try {
			const response = Schema.decodeUnknownSync(Response)(JSON.parse(line));
			if (response.id === undefined) {
				return;
			}
			const request = pending.get(response.id);
			pending.delete(response.id);
			if (response.error) {
				request?.reject(new Error(JSON.stringify(response.error)));
			} else {
				request?.resolve(response.result);
			}
		} catch {
			rejectPending(new Error(`Non-protocol stdout: ${line}`));
		}
	});
	function send(method: string, params: unknown) {
		return Effect.tryPromise(
			() =>
				new Promise<unknown>((resolve, reject) => {
					nextId += 1;
					const id = nextId;
					pending.set(id, { reject, resolve });
					child.stdin.write(`${JSON.stringify({ id, jsonrpc: "2.0", method, params })}\n`);
				}),
		).pipe(Effect.timeout("15 seconds"));
	}
	yield* send("initialize", { capabilities: {}, clientInfo: { name: "board-test", version: "1" }, protocolVersion: "2025-11-25" });
	child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
	return {
		call: (name: string, args: Record<string, unknown> = {}) =>
			send("tools/call", { arguments: args, name }).pipe(Effect.map(Schema.decodeUnknownSync(Result))),
		diagnostics: () => stderr,
		list: () => send("tools/list", {}),
	};
});

export function toolValue(result: typeof Result.Type): unknown {
	return JSON.parse(result.content.map((entry) => entry.text).join(""));
}
