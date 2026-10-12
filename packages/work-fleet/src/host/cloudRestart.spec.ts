import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { hostLayer } from "#host/commands.ts";
import { hostProvider } from "#host/providers.ts";
import type { FleetRecord } from "#model.ts";
import { type Boundary, restartBackend } from "#test/cloudRestart.ts";
import { codexServer } from "#test/codex.ts";
import { authFolder, FUTURE_EXPIRY, SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { daemonClient } from "#test/daemonClient.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { hostProcess } from "#test/hostProcess.ts";
import { retryInterrupted } from "#test/retryInterrupted.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const expected = {
	"acknowledged-turn": { recoverable: true, sessions: 1, turnRequests: 1, turns: 1 },
	"after-thread": { recoverable: false, sessions: 1, turnRequests: 0, turns: 0 },
	"after-turn": { recoverable: true, sessions: 1, turnRequests: 1, turns: 1 },
	"before-thread": { recoverable: false, sessions: 0, turnRequests: 0, turns: 0 },
	"before-turn": { recoverable: true, sessions: 1, turnRequests: 2, turns: 1 },
	"before-turn-request": { recoverable: true, sessions: 1, turnRequests: 1, turns: 1 },
	"changed-context": { recoverable: false, sessions: 1, turnRequests: 0, turns: 0 },
	"late-turn": { recoverable: true, sessions: 1, turnRequests: 1, turns: 1 },
	"retry": { recoverable: true, sessions: 1, turnRequests: 2, turns: 1 },
	"revoked-approval": { recoverable: false, sessions: 1, turnRequests: 0, turns: 0 },
};

function cannotRenew(fixture: HostFixture, record: FleetRecord) {
	const layer = hostLayer(fixture.host, { ...fixture.parts, provider: hostProvider(fixture.host) });
	return Effect.gen(function* () {
		const fleet = yield* Fleet;
		const denied = yield* fleet
			.prepare({ cwd: record.cwd, preparation: record.preparation, prompt: record.prompt, workId: record.workId })
			.pipe(Effect.result);
		expect(denied._tag).toBe("Failure");
	}).pipe(Effect.provide(layer));
}

const interruptHost = Effect.fn("CloudRestart.interruptHost")(function* (
	fixture: HostFixture,
	backend: ReturnType<typeof restartBackend>,
	boundary: Boundary,
) {
	const first = yield* hostProcess(fixture.configFile, true);
	yield* first.until(() => Effect.succeed(first.url !== undefined));
	const client = yield* daemonClient(first.url ?? "missing");
	function readRecord() {
		return client("fleet.get", { workId: "synthetic-work" });
	}
	yield* first.until(() => Effect.succeed(backend.reached));
	if (boundary === "acknowledged-turn") {
		yield* first.until(() => readRecord().pipe(Effect.map((record) => record.attempts[0]?.receipt !== undefined)));
	}
	const before = yield* readRecord();
	expect(before.attempts).toHaveLength(1);
	expect(["submitting", "accepted", "running"]).toContain(before.attempts[0]?.status);
	yield* first.kill;
	if (boundary === "changed-context") {
		fixture.write("work.md", task("synthetic-work", "approved", "Changed scope"));
	}
	if (boundary === "revoked-approval") {
		fixture.write("work.md", task("synthetic-work"));
	}
	const { recoverable } = expected[boundary];
	if (boundary === "retry") {
		yield* retryInterrupted(fixture);
		backend.allowRetry();
	}
	const restarted = yield* hostProcess(fixture.configFile, true);
	yield* restarted.until(() => Effect.succeed(restarted.url !== undefined));
	const peer = yield* daemonClient(restarted.url ?? "missing");
	function readRecovered() {
		return peer("fleet.get", { workId: "synthetic-work" });
	}
	yield* restarted.until(() =>
		readRecovered().pipe(Effect.map((record) => (recoverable ? record.attempts[0]?.status === "running" : record.stage === "needs-human"))),
	);
	const after = yield* readRecovered();
	yield* restarted.kill;
	expect(after.attempts).toHaveLength(1);
	expect(after.attempts[0]?.operationId).toBe(before.attempts[0]?.operationId);
	if (!recoverable) {
		const owner = boundary === "changed-context" ? "maintainer" : "orchestrator";
		expect(after).toMatchObject({ attentionOwner: owner, decision: { attentionOwner: owner } });
		if (boundary === "changed-context") {
			expect(after.decision?.reason).toBe("Board context changed");
		}
		expect(after.attempts[0]?.status).toBe("submitting");
		yield* cannotRenew(fixture, after);
	}
	if (recoverable) {
		expect(after.attempts[0]?.receipt).toEqual({ sessionId: "synthetic-session", turnId: "synthetic-turn" });
	}
	if (boundary === "retry") {
		expect(after.decision).toBeUndefined();
		expect(after.responses).toMatchObject([{ action: "retry", boardAcknowledged: true }]);
	}
	expect(backend.sessions).toBe(expected[boundary].sessions);
	expect(backend.turns).toBe(expected[boundary].turns);
	expect(backend.requests.filter((request) => request.method === "thread/start")).toHaveLength(1);
	expect(backend.requests.filter((request) => request.method === "turn/start")).toHaveLength(expected[boundary].turnRequests);
	expect(backend.requests.some((request) => request.method === "thread/turns/list")).toBe(
		boundary !== "changed-context" && before.attempts[0]?.sessionId !== undefined,
	);
});

function restartStory(boundary: Boundary) {
	return Effect.scoped(
		Effect.gen(function* () {
			const backend = restartBackend(boundary);
			const server = yield* codexServer(backend.handle);
			const authFile = yield* authFolder(syntheticToken("current", FUTURE_EXPIRY));
			return yield* withHost(
				{ "work.md": task("synthetic-work", "approved") },
				{
					cloud: { authFile, cwd: SYNTHETIC_WORKSPACE, endpoint: server.endpoint, environmentId: SYNTHETIC_ENVIRONMENT, requestTimeoutMs: 60_000 },
					provider: "cloud",
					worker: { branchPrefix: "synthetic/", sharedEnvironment: "/synthetic/env.sh" },
				},
				(fixture) => interruptHost(fixture, backend, boundary).pipe(Effect.scoped),
			);
		}),
	);
}

describe("Cloud daemon restarts against PostgreSQL and HTTP", () => {
	const test = it.live.skipIf(storageDatabaseUrl === undefined);
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
		test(`SIGKILL at ${boundary} recovers known threads without a second thread or accepted turn`, () => restartStory(boundary), 40_000);
	}
});
