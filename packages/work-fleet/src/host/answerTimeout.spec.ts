import { expect } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { task } from "#test/fleetHost.ts";
import { delayedAnswer } from "#test/hostCommandDelaysTraits.ts";
import { approvedWork, host } from "#test/hostStory.ts";

for (const command of ["answer", "dispatch"] as const) {
	for (const fail of [false, true]) {
		host.it(
			`${command} acknowledges a durable record while provider steering is blocked, failure=${fail}`,
			[approvedWork(["one"]), delayedAnswer("steer", fail)],
			function* (daemon) {
				const started = yield* daemon.dispatch("one");
				const current = task("one", "approved", "Revised criteria.");
				daemon.writeBoard("one.md", current.replace("kind: task", "kind: task\nowner: marvin"));
				const stopped = yield* daemon.reconcile("one");
				expect(stopped.decision?.code).toBe("fleet-stale");
				daemon.writeBoard("one.md", current);
				daemon.enableDelay();
				const accepted = yield* command === "answer" ? daemon.acknowledgeAnswer("one") : daemon.acknowledgeDispatch("one");
				expect(accepted.workId).toBe("one");
				if (command === "answer") {
					expect("blocker" in accepted ? accepted.blocker : undefined).toBe("Answer recorded; applying in the background");
				}
				yield* daemon.awaitDelay();
				if (command === "answer") {
					expect(daemon.readBoard(`responses/response.fleet-retry.${stopped.decision?.published?.questionId}.md`)).toContain("author: orchestrator");
				}
				const pending = yield* daemon.get("one");
				expect(pending.boardContext).toBe(current);
				expect(pending.attempts[0]?.receipt).toEqual(started.attempts[0]?.receipt);
				expect(pending.attempts[0]?.briefSteers).toEqual([expect.objectContaining({ requestedAt: expect.any(Number) })]);
				yield* daemon.releaseDelay();
				const finished = yield* daemon.waitForRecord("one", (record) => {
					const evidence = record.attempts[0]?.briefSteers?.[0];
					return evidence?.steeredAt !== undefined || evidence?.error !== undefined;
				});
				expect(finished.attempts[0]?.briefSteers?.[0]).toMatchObject(
					fail ? { error: "Delayed provider failure" } : { steeredAt: expect.any(Number) },
				);
			},
		);
	}
}

for (const command of ["answer", "release", "dispatch"] as const) {
	host.it(
		`the ${command} CLI exits while its provider work remains blocked`,
		[approvedWork(["one"]), delayedAnswer(command === "release" ? "archive" : "startTurn")],
		function* (daemon) {
			if (command !== "dispatch") {
				yield* daemon.dispatch("one");
				yield* daemon.workerQuestion();
				yield* daemon.reconcile("one");
			}
			daemon.enableDelay();
			const args = command === "dispatch" ? ["dispatch", "one"] : ["answer", "one", ...(command === "release" ? ["--release"] : ["Use PostgreSQL."])];
			const request = yield* daemon.cli(args, { holdStdin: command === "release", selection: "port" }).pipe(Effect.forkScoped);
			yield* daemon.awaitDelay();
			const result = yield* Fiber.join(request).pipe(Effect.timeout("3 seconds"));
			expect(result.code).toBe(0);
			expect(result.stdout).toContain("recorded");
			yield* daemon.releaseDelay();
			yield* daemon.waitForRecord("one", (record) =>
				command === "release" ? record.attempts[0]?.sessionCleanupComplete === true : record.attempts.at(-1)?.receipt !== undefined,
			);
		},
	);
}
