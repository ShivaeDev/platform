import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { expect } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { authPost, credentials } from "./authHttp.ts";
import { deployChild } from "./deployChild.ts";

export function deploymentProcesses(tell: (line: string) => void) {
	const startProcess = Effect.fn("DeploymentStory.startProcess")(function* (kind: "worker" | "web", port = 0) {
		tell(`start the ${kind} process`);
		const database = yield* PostgresTestDatabase;
		return yield* deployChild(kind, database.url, port).pipe(Effect.provide(NodeServices.layer));
	});
	return {
		refusesUnmigratedSchema: Effect.fn("DeploymentStory.refusesUnmigratedSchema")(function* (port: number) {
			tell("web and worker refuse to start before migration");
			for (const kind of ["worker", "web"] as const) {
				const pending = yield* startProcess(kind, port);
				const premature = pending.ready.pipe(
					Effect.catch(() => Effect.never),
					Effect.andThen(Effect.fail(new Error(`${kind} started before migrations were applied`))),
				);
				expect(yield* Effect.raceFirst(pending.child.exitCode, premature)).not.toBe(0);
				const output = [...pending.logs, ...pending.errors].join("\n");
				expect(output).toContain("Database migrations are not current");
				expect(output).not.toContain("Database schema mismatch");
				expect(pending.logs.filter((line) => line.startsWith("EFFECT_LOG Worker"))).toEqual([]);
			}
			yield* Effect.promise(() => expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow());
		}),
		startProcess,
		startsServingAccountsAndJobs: Effect.fn("DeploymentStory.startsServingAccountsAndJobs")(function* (port: number) {
			tell("web accepts signup and worker starts taking jobs after migration");
			const worker = yield* startProcess("worker");
			const web = yield* startProcess("web", port);
			expect(yield* worker.ready).toBe("worker");
			const address = yield* web.ready;
			expect((yield* Effect.promise(() => fetch(`${address}/health`))).status).toBe(200);
			expect(yield* authPost(address, "sign-up/email", credentials("deploy"))).toContain("session_token=");
			expect([...web.logs, ...web.errors].join("\n")).not.toContain("Database schema mismatch");
			expect(worker.logs.filter((line) => line.startsWith("EFFECT_LOG Worker"))).toEqual([
				"EFFECT_LOG Worker migrations applied",
				"EFFECT_LOG Worker ready to take jobs",
			]);
			expect(yield* worker.child.isRunning).toBe(true);
			expect(yield* web.child.isRunning).toBe(true);
		}),
	};
}
