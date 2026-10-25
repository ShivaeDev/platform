import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE } from "#test/codexCloud.ts";
import { task } from "#test/fleetHost.ts";
import { host } from "#test/hostStory.ts";
import { interruptedCloudTrait } from "#test/interruptedCloudTrait.ts";

const expected = {
	"acknowledged-turn": { recoverable: true, sessions: 1, turnRequests: 1, turns: 1 },
	"after-thread": { recoverable: false, sessions: 1, turnRequests: 0, turns: 0 },
	"after-turn": { recoverable: true, sessions: 1, turnRequests: 1, turns: 1 },
	"before-thread": { recoverable: false, sessions: 0, turnRequests: 0, turns: 0 },
	"before-turn": { recoverable: true, sessions: 1, turnRequests: 2, turns: 1 },
	"before-turn-request": { recoverable: true, sessions: 1, turnRequests: 1, turns: 1 },
	"changed-context": { recoverable: true, sessions: 1, turnRequests: 1, turns: 1 },
	"late-turn": { recoverable: true, sessions: 1, turnRequests: 1, turns: 1 },
	"retry": { recoverable: true, sessions: 1, turnRequests: 2, turns: 1 },
	"revoked-approval": { recoverable: false, sessions: 1, turnRequests: 0, turns: 0 },
};

for (const boundary of [
	"before-thread",
	"after-thread",
	"before-turn-request",
	"changed-context",
	"revoked-approval",
	"before-turn",
	"after-turn",
	"late-turn",
	"retry",
	"acknowledged-turn",
] as const) {
	host.it(
		`SIGKILL at ${boundary} recovers known threads without a second thread or accepted turn`,
		[interruptedCloudTrait(boundary)],
		function* (daemon) {
			const first = yield* daemon.spawnHost();
			yield* first.until(() => Effect.succeed(first.url !== undefined));
			const client = yield* daemon.processClient(first.url);
			yield* first.until(() => Effect.succeed(daemon.cloudBoundaryReached()));
			if (boundary === "acknowledged-turn") {
				yield* first.until(() =>
					client("fleet.get", { workId: "synthetic-work" }).pipe(Effect.map((record) => record.attempts[0]?.receipt !== undefined)),
				);
			}
			const before = yield* client("fleet.get", { workId: "synthetic-work" });
			expect(before.attempts).toMatchObject([{ role: "worker" }]);
			expect(["submitting", "accepted", "running"]).toContain(before.attempts[0]?.status);
			yield* first.kill;
			if (boundary === "changed-context") {
				daemon.writeBoard("work.md", task("synthetic-work", "approved", "Changed scope"));
			}
			if (boundary === "revoked-approval") {
				daemon.writeBoard("work.md", task("synthetic-work"));
			}
			const { recoverable } = expected[boundary];
			if (boundary === "retry") {
				const interrupted = yield* daemon.retryInterrupted();
				expect(interrupted?.attempts[0]).toMatchObject({ sessionId: "synthetic-session", status: "submitting" });
				expect(interrupted?.attempts[0]?.receipt).toBeUndefined();
				daemon.allowCloudRetry();
			}
			const restarted = yield* daemon.spawnHost();
			yield* restarted.until(() => Effect.succeed(restarted.url !== undefined));
			const peer = yield* daemon.processClient(restarted.url);
			yield* restarted.until(() =>
				peer("fleet.get", { workId: "synthetic-work" }).pipe(
					Effect.map((record) => (recoverable ? record.attempts[0]?.status === "running" : record.step === "waiting")),
				),
			);
			const after = yield* peer("fleet.get", { workId: "synthetic-work" });
			yield* restarted.kill;
			expect(after.attempts.map(({ operationId }) => operationId)).toEqual(before.attempts.map(({ operationId }) => operationId));
			if (!recoverable) {
				const owner = boundary === "revoked-approval" ? "maintainer" : "orchestrator";
				expect(after).toMatchObject({ attentionOwner: owner, decision: { attentionOwner: owner } });
				if (boundary === "revoked-approval") {
					expect(after.decision?.code).toBe("approval-required");
				}
				expect(after.attempts[0]?.status).toBe("submitting");
				expect((yield* daemon.renewCloudWork(after))._tag).toBe("Failure");
			}
			if (recoverable) {
				expect(after.attempts[0]?.receipt).toEqual({ sessionId: "synthetic-session", turnId: "synthetic-turn" });
			}
			if (boundary === "changed-context") {
				expect(after.decision).toBeUndefined();
				expect(after.boardContext).toBe(task("synthetic-work", "approved", "Changed scope"));
				expect(after.boardRevision).not.toBe(before.boardRevision);
			}
			if (boundary === "retry") {
				expect(after.decision).toBeUndefined();
				expect(after.responses).toMatchObject([{ action: "retry", boardAcknowledged: true }]);
			}
			expect(daemon.cloudLaunches().sessions).toBe(expected[boundary].sessions);
			expect(daemon.cloudLaunches().turns).toBe(expected[boundary].turns);
			expect(daemon.cloudLaunches().requests.filter((request) => request.method === "thread/start")).toMatchObject([
				{ params: { environments: [{ cwd: SYNTHETIC_WORKSPACE, environmentConfigId: SYNTHETIC_ENVIRONMENT }] } },
			]);
			expect(daemon.cloudLaunches().requests.filter((request) => request.method === "turn/start")).toHaveLength(expected[boundary].turnRequests);
			expect(daemon.cloudLaunches().requests.some((request) => request.method === "thread/turns/list")).toBe(
				before.attempts[0]?.sessionId !== undefined,
			);
			// The configured 1 s recovery grace allows about five empty-thread scans at the 250 ms poll; the 5 s default would allow about twenty.
			expect(daemon.cloudLaunches().requests.filter((request) => request.method === "thread/turns/list").length).toBeLessThanOrEqual(10);
		},
		40_000,
	);
}
