import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { hostLayer } from "#host/commands.ts";
import { hostProvider } from "#host/providers.ts";
import { cloudFanout } from "#test/cloudFanout.ts";
import { hostProcess, until } from "#test/cloudRestart.ts";
import { codexServer } from "#test/codex.ts";
import { authFolder, FUTURE_EXPIRY, SYNTHETIC_ENVIRONMENT, SYNTHETIC_WORKSPACE, syntheticToken } from "#test/codexCloud.ts";
import { type HostFixture, task, withHost } from "#test/fleetHost.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

function records(fixture: HostFixture) {
	return Effect.gen(function* () {
		return yield* (yield* Fleet).list();
	}).pipe(Effect.provide(hostLayer(fixture.host, { ...fixture.parts, provider: hostProvider(fixture.host) })));
}

const killFanout = Effect.fn("CloudFanout.killFanout")(function* (fixture: HostFixture, backend: ReturnType<typeof cloudFanout>) {
	const first = yield* hostProcess(fixture.configFile);
	yield* until(() => Effect.succeed(backend.operations.size === 100));
	const before = yield* records(fixture);
	expect(before).toHaveLength(100);
	expect(
		before.every(
			({ value }) => value.attempts.length === 1 && value.attempts[0]?.sessionId !== undefined && value.attempts[0]?.receipt === undefined,
		),
	).toBe(true);
	yield* first.kill;
	const restarted = yield* hostProcess(fixture.configFile);
	yield* until(() =>
		records(fixture).pipe(Effect.map((stored) => stored.length === 100 && stored.every(({ value }) => value.attempts[0]?.status === "running"))),
	);
	yield* restarted.kill;
	const after = yield* records(fixture);
	for (const { value } of after) {
		const [attempt] = value.attempts;
		expect(value.attempts).toHaveLength(1);
		expect(attempt?.operationId).toBe(before.find((stored) => stored.value.workId === value.workId)?.value.attempts[0]?.operationId);
		expect(attempt?.receipt).toEqual({ sessionId: attempt?.sessionId, turnId: `turn-${attempt?.sessionId}` });
	}
	expect(new Set(backend.operations.values()).size).toBe(100);
	expect(backend.sessions).toHaveLength(100);
	expect(backend.mutations.filter((method) => method === "thread/start")).toHaveLength(100);
	expect(backend.mutations.filter((method) => method === "turn/start")).toHaveLength(100);
});

function fanoutStory() {
	return Effect.scoped(
		Effect.gen(function* () {
			const backend = cloudFanout();
			const server = yield* codexServer(backend.handle);
			const authFile = yield* authFolder(syntheticToken("current", FUTURE_EXPIRY));
			const files = Object.fromEntries(
				Array.from({ length: 100 }, (_unused, index) => [`work-${index}.md`, task(`synthetic-work-${index}`, "approved")]),
			);
			return yield* withHost(
				files,
				{
					cloud: { authFile, cwd: SYNTHETIC_WORKSPACE, endpoint: server.endpoint, environmentId: SYNTHETIC_ENVIRONMENT, requestTimeoutMs: 60_000 },
					provider: "cloud",
					worker: { branchPrefix: "synthetic/", sharedEnvironment: "/synthetic/env.sh" },
				},
				(fixture) => killFanout(fixture, backend),
			);
		}),
	);
}

describe("Cloud fanout restarts against PostgreSQL", () => {
	it.live.skipIf(storageDatabaseUrl === undefined)(
		"SIGKILL with 100 lost turn acknowledgements recovers exactly one session per attempt",
		fanoutStory,
		60_000,
	);
});
