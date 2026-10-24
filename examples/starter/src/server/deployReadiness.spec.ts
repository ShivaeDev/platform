import { Effect } from "effect";
import { expect } from "vitest";
import { deployment } from "#test-support/deployment.ts";

const SUCCESSFUL_EXIT = 0;
const OK_STATUS = 200;

deployment.it(
	"web rejects a missing schema while an already-started worker waits for deployment migration",
	[],
	function* ({ migrate, startProcess, health, signUpAt, port: availablePort, migrationTable }) {
		const port = yield* availablePort;
		const prematureWeb = yield* startProcess("web", port);
		expect(yield* prematureWeb.child.exitCode).not.toBe(SUCCESSFUL_EXIT);
		expect([...prematureWeb.logs, ...prematureWeb.errors].join("\n")).toContain("Database migrations are not current");
		expect([...prematureWeb.logs, ...prematureWeb.errors].join("\n")).not.toContain("Database schema mismatch");
		yield* Effect.promise(() => expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow());
		const worker = yield* startProcess("worker");
		yield* worker.waitingForSchema;
		expect(yield* worker.child.isRunning).toBe(true);
		expect(worker.logs).toEqual([expect.stringContaining("Worker waiting for schema")]);
		expect(yield* migrationTable).toEqual([{ ledger: null }]);
		expect(yield* migrate()).toBe(SUCCESSFUL_EXIT);
		expect(yield* worker.ready).toBe("worker");
		const web = yield* startProcess("web", port);
		const address = yield* web.ready;
		expect((yield* health(address)).status).toBe(OK_STATUS);
		const signup = yield* signUpAt(address, "deploy");
		expect(signup.status).toBe(OK_STATUS);
		expect(signup.cookie).toContain("session_token=");
		expect([...web.logs, ...web.errors].join("\n")).not.toContain("Database schema mismatch");
		expect(worker.logs.filter((line) => line.includes("Worker "))).toEqual([
			expect.stringContaining("Worker waiting for schema"),
			expect.stringContaining("Worker schema current"),
			expect.stringContaining("Worker ready to take jobs"),
		]);
		expect(yield* worker.child.isRunning).toBe(true);
		expect(yield* web.child.isRunning).toBe(true);
	},
);
