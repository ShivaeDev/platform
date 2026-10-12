import { createServer } from "node:http";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { cliProcess } from "#test/fleetCli.ts";

function unusedPort() {
	return new Promise<number>((resolve, reject) => {
		const server = createServer();
		server.on("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (address === null || typeof address === "string") {
				reject(new Error("Expected TCP address"));
				return;
			}
			server.close((error) => (error ? reject(error) : resolve(address.port)));
		});
	});
}

describe("Fleet commands without a daemon", () => {
	for (const [command, args] of [
		["status", []],
		["wait", ["unknown"]],
		["watch", ["unknown"]],
		["dispatch", ["unknown"]],
		["continue", ["unknown", "Continue work"]],
		["release", ["unknown"]],
		["reassign", ["unknown", "decision", "maintainer"]],
		["name-threads", []],
		["decide", ["unknown", "retry"]],
	] as const) {
		it.live(`${command} names the missing daemon and how to start it`, function* () {
			const port = yield* Effect.promise(unusedPort);
			let stderr = "";
			const result = yield* Effect.promise(() =>
				cliProcess([command, ...args, "--port", String(port)], {
					onError: (text) => {
						stderr += text;
					},
				}),
			);
			expect(result.code).toBe(1);
			expect(stderr).toContain(`No Fleet daemon is running at 127.0.0.1:${port}`);
			expect(stderr).toContain(`start work-fleet serve <board-dir> --port ${port}`);
			expect(stderr).not.toContain("PostgreSQL");
		});
	}
});
