import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { Effect } from "effect";
import { SourceFailure } from "#diagnostics/source.ts";
import { codexReply } from "./codexProtocol.ts";

export function codexRateLimits(
	launch: () => ChildProcessWithoutNullStreams = () => spawn("codex", ["app-server", "--listen", "stdio://"], { stdio: "pipe" }),
	timeoutMs = 30_000,
) {
	return Effect.callback<unknown, SourceFailure>((resume) => {
		const child = launch();
		const lines = createInterface({ input: child.stdout });
		let settled = false;
		function finish(result: Effect.Effect<unknown, SourceFailure>) {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			lines.close();
			child.kill();
			resume(result);
		}
		function fail(message: string, kind: SourceFailure["kind"] = "error") {
			finish(Effect.fail(new SourceFailure({ kind, message })));
		}
		function send(value: unknown) {
			child.stdin.write(`${JSON.stringify(value)}\n`);
		}
		const timer = setTimeout(() => fail("Codex rate limits timed out"), timeoutMs);
		child.on("error", (error) =>
			fail(`Codex app-server could not start: ${error.message}`, "code" in error && error.code === "ENOENT" ? "not-configured" : "error"),
		);
		child.on("exit", () => fail("Codex app-server exited before reporting rate limits"));
		child.stdin.on("error", () => fail("Codex app-server input closed before reporting rate limits"));
		child.stderr.resume();
		lines.on("line", (line) => {
			const reply = codexReply(line);
			if ("send" in reply) {
				for (const message of reply.send) {
					send(message);
				}
			} else if ("failure" in reply) {
				finish(Effect.fail(reply.failure));
			} else {
				finish(Effect.succeed(reply.result));
			}
		});
		send({
			id: "initialize",
			method: "initialize",
			params: { capabilities: { experimentalApi: true }, clientInfo: { name: "work-board", version: "0.0.0" } },
		});
		return Effect.sync(() => {
			settled = true;
			clearTimeout(timer);
			lines.close();
			child.kill();
		});
	});
}
