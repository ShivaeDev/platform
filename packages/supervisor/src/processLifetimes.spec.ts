import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { processes } from "#test/processes.ts";

processes.it(
	"crashes restart after increasing backoff capped at the application's maximum",
	[],
	function* ({ begin, started, release, running, crash, backoff, awaitReady, backoffPasses }) {
		yield* begin("server");
		let server = yield* started("server");
		yield* release(server.pid);
		yield* running("server");
		for (const delay of [100, 200, 200]) {
			const crashedAt = yield* crash(server.pid);

			expect(yield* backoff("server")).toBe(delay);
			yield* backoffPasses(delay);
			server = yield* started("server");
			expect(server.at - crashedAt).toBeGreaterThanOrEqual(delay);
			yield* release(server.pid);
			yield* awaitReady("server", server.pid);
		}
	},
);

processes.it(
	"closing the application scope stops every child, including one ignoring SIGTERM",
	[],
	function* ({ begin, started, release, running, close, alive }) {
		yield* begin("server");
		const server = yield* started("server");
		yield* release(server.pid);
		yield* running("server");
		yield* begin("runner", { stubborn: true });
		const runner = yield* started("runner");
		yield* release(runner.pid);
		yield* running("runner");
		yield* outcomes([
			["server running", () => alive(server.pid), true],
			["runner running", () => alive(runner.pid), true],
		]);

		yield* close();

		yield* outcomes([
			["server stopped", () => alive(server.pid), false],
			["runner stopped", () => alive(runner.pid), false],
		]);
	},
);

processes.it("closing during readiness interrupts startup and leaves no child", [], function* ({ begin, started, close, interrupted, alive }) {
	yield* begin("server");
	const server = yield* started("server");

	yield* close();

	yield* outcomes([
		["startup interrupted", () => interrupted("server"), true],
		["server stopped", () => alive(server.pid), false],
	]);
});

processes.it(
	"invalid readiness on a replacement fails await with its typed Schema failure",
	[],
	function* ({ begin, started, release, running, crash, malformedReadiness, replacementFailure, alive, backoff, backoffPasses }) {
		yield* begin("server");
		const server = yield* started("server");
		yield* release(server.pid);
		yield* running("server");
		yield* crash(server.pid);
		const delay = yield* backoff("server");
		yield* backoffPasses(delay);
		const replacement = yield* started("server");

		yield* malformedReadiness(replacement.pid);

		yield* outcomes([
			["typed replacement failure", () => replacementFailure("server"), "invalid readiness"],
			["replacement stopped", () => alive(replacement.pid), false],
		]);
	},
);

processes.it("graceful scope cleanup captures the child's final output", [], function* ({ begin, started, release, running, close, logs }) {
	yield* begin("server");
	const server = yield* started("server");
	yield* release(server.pid);
	yield* running("server");

	yield* close();

	expect(yield* logs("server")).toContainEqual({ source: "stdout", text: "stopping" });
});

processes.it(
	"closing during backoff prevents another child from starting",
	[],
	function* ({ begin, started, release, running, crash, backoff, close, backoffPasses, pids, interrupted }) {
		yield* begin("server");
		const server = yield* started("server");
		yield* release(server.pid);
		yield* running("server");
		yield* crash(server.pid);
		const delay = yield* backoff("server");
		expect(yield* pids()).toEqual([server.pid]);

		yield* close();
		yield* backoffPasses(delay);

		yield* outcomes([
			["supervision interrupted", () => interrupted("server"), true],
			["no replacement started", () => pids(), [server.pid]],
		]);
	},
);
