import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { processes } from "#test/processes.ts";

processes.it(
	"a JSON readiness handshake releases startup and captures both output streams",
	[],
	function* ({ begin, started, release, ready, waitForLog, logs }) {
		yield* begin("server");
		const server = yield* started("server");

		yield* release(server.pid);
		yield* waitForLog("server", "serving requests");

		yield* outcomes([
			["ready server", () => ready("server"), { pid: server.pid, status: "ready", value: { pid: server.pid } }],
			[
				"captured output",
				() => logs("server"),
				[
					{ source: "stderr", text: `started:${server.pid}` },
					{ source: "stdout", text: expect.stringContaining(`"pid":${server.pid}`) },
					{ source: "stdout", text: "serving requests" },
				],
			],
		]);
	},
);

processes.it("a readiness timeout fails startup and stops its child", [], function* ({ begin, started, failure, alive, readinessDeadlinePasses }) {
	yield* begin("server", { timeout: 200 });
	const server = yield* started("server");

	yield* readinessDeadlinePasses();

	yield* outcomes([
		["startup timeout", () => failure("server"), "server readiness timed out"],
		["server stopped", () => alive(server.pid), false],
	]);
});

processes.it(
	"a dependent starts only after its dependency is ready and receives its readiness data",
	[],
	function* ({ begin, started, release, ready, pids }) {
		yield* begin("postgres");
		const postgres = yield* started("postgres");
		yield* begin("server", { after: "postgres" });
		expect(yield* pids()).toEqual([postgres.pid]);

		yield* release(postgres.pid);
		const server = yield* started("server");
		yield* release(server.pid);

		expect(yield* ready("server")).toMatchObject({ value: { dependency: String(postgres.pid) } });
	},
);

processes.it(
	"invalid readiness retains its typed Schema failure and stops the child",
	[],
	function* ({ begin, started, malformedReadiness, failure, alive }) {
		yield* begin("server");
		const server = yield* started("server");

		yield* malformedReadiness(server.pid);

		yield* outcomes([
			["typed readiness failure", () => failure("server"), "invalid readiness"],
			["server stopped", () => alive(server.pid), false],
		]);
	},
);

processes.it(
	"a child without a handshake starts immediately and keeps capturing stdout",
	[],
	function* ({ begin, started, running, release, waitForLog, logs }) {
		yield* begin("runner", { handshake: false });
		const runner = yield* started("runner");
		yield* running("runner");

		yield* release(runner.pid);
		yield* waitForLog("runner", "serving requests");

		expect(yield* logs("runner")).toContainEqual({ source: "stdout", text: "serving requests" });
	},
);

processes.it("a child exiting before readiness fails startup with its exit code", [], function* ({ begin, started, exitBeforeReady, failure }) {
	yield* begin("server", { handshake: "wait" });
	const server = yield* started("server");

	yield* exitBeforeReady(server.pid);

	expect(yield* failure("server")).toBe("exit 7 before readiness");
});

processes.it(
	"closing stdout without a handshake reports missing readiness and stops the child",
	[],
	function* ({ begin, started, closeReadiness, failure, alive }) {
		yield* begin("server");
		const server = yield* started("server");

		yield* closeReadiness(server.pid);

		yield* outcomes([
			["missing readiness", () => failure("server"), "stdout closed before readiness"],
			["server stopped", () => alive(server.pid), false],
		]);
	},
);

processes.it(
	"a readiness timeout drains noisy output and stops a child whose readiness check reads no stdout",
	[],
	function* ({ begin, started, release, waitForLog, readinessDeadlinePasses, failure, alive, logs }) {
		yield* begin("server", { handshake: "wait", noisy: true, timeout: 200 });
		const server = yield* started("server");
		yield* release(server.pid);
		yield* waitForLog("server", "serving requests");

		yield* readinessDeadlinePasses();

		yield* outcomes([
			["readiness timed out", () => failure("server"), "server readiness timed out"],
			["server stopped", () => alive(server.pid), false],
			["shutdown output drained", () => logs("server"), expect.arrayContaining([{ source: "stdout", text: "stopping" }])],
		]);
	},
);
