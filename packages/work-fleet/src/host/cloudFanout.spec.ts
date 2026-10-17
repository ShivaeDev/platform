import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { hostLayer } from "#host/commands.ts";
import { hostProvider } from "#host/providers.ts";
import { cloudFanout } from "#test/cloudFanout.ts";
import { codexServer } from "#test/codex.ts";
import { authFolder, FUTURE_EXPIRY, SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { hostProcess } from "#test/hostProcess.ts";
import { postgresTests } from "#test/postgres.ts";

const ATTEMPTS = 10;

function records(fixture: HostFixture) {
	return Effect.gen(function* () {
		return yield* (yield* Fleet).list();
	}).pipe(Effect.provide(hostLayer(fixture.host, { ...fixture.parts, provider: hostProvider(fixture.host) })));
}

const killFanout = Effect.fn("CloudFanout.killFanout")(function* (fixture: HostFixture, backend: ReturnType<typeof cloudFanout>) {
	const first = yield* hostProcess(fixture.configFile);
	yield* first.until(() =>
		records(fixture).pipe(
			Effect.map((stored) => ({
				done: backend.operations.size === ATTEMPTS,
				progress: stored.length + backend.sessions.length + backend.operations.size,
			})),
		),
	);
	const before = yield* records(fixture);
	expect(before).toHaveLength(ATTEMPTS);
	expect(
		before.every(
			({ value }) => value.attempts.length === 1 && value.attempts[0]?.sessionId !== undefined && value.attempts[0]?.receipt === undefined,
		),
	).toBe(true);
	yield* first.kill;
	const restarted = yield* hostProcess(fixture.configFile);
	yield* restarted.until(() =>
		records(fixture).pipe(
			Effect.map((stored) => {
				const running = stored.filter(({ value }) => value.attempts[0]?.status === "running").length;
				const acknowledged = stored.filter(({ value }) => value.attempts[0]?.receipt !== undefined).length;
				return { done: stored.length === ATTEMPTS && running === ATTEMPTS, progress: acknowledged + running };
			}),
		),
	);
	yield* restarted.kill;
	const after = yield* records(fixture);
	for (const { value } of after) {
		const [attempt] = value.attempts;
		expect(value.attempts).toHaveLength(1);
		expect(attempt?.operationId).toBe(before.find((stored) => stored.value.workId === value.workId)?.value.attempts[0]?.operationId);
		expect(attempt?.receipt).toEqual({ sessionId: attempt?.sessionId, turnId: `turn-${attempt?.sessionId}` });
	}
	expect(new Set(backend.operations.values()).size).toBe(ATTEMPTS);
	expect(backend.sessions).toHaveLength(ATTEMPTS);
	expect(backend.mutations.filter((method) => method === "thread/start")).toHaveLength(ATTEMPTS);
	expect(backend.mutations.filter((method) => method === "turn/start")).toHaveLength(ATTEMPTS);
});

function fanoutStory() {
	return Effect.scoped(
		Effect.gen(function* () {
			const backend = cloudFanout();
			const server = yield* codexServer(backend.handle);
			const authFile = yield* authFolder(syntheticToken("current", FUTURE_EXPIRY));
			const files = Object.fromEntries(
				Array.from({ length: ATTEMPTS }, (_unused, index) => [`work-${index}.md`, task(`synthetic-work-${index}`, "approved")]),
			);
			return yield* withHost(
				files,
				{
					// Each lost acknowledgement must time out before sequential dispatch can reach the next attempt.
					cloud: { authFile, cwd: SYNTHETIC_WORKSPACE, endpoint: server.endpoint, environmentId: SYNTHETIC_ENVIRONMENT, requestTimeoutMs: 1000 },
					provider: "cloud",
					worker: { branchPrefix: "synthetic/", sharedEnvironment: "/synthetic/env.sh" },
				},
				(fixture) => killFanout(fixture, backend).pipe(Effect.scoped),
			);
		}),
	);
}

describe("Cloud fanout restarts against PostgreSQL", () => {
	postgresTests("live")(
		`SIGKILL with ${ATTEMPTS} lost turn acknowledgements recovers exactly one session per attempt`,
		fanoutStory,
		// Each launch and recovery phase is bounded by the progress stall timer.
		0,
	);
});
