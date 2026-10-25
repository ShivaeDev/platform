import { expect } from "@effect/vitest";
import { Clock, Effect } from "effect";
import { fanoutCloudTrait } from "#test/fanoutCloudTrait.ts";
import { host } from "#test/hostStory.ts";

const ATTEMPTS = 10;

host.it(
	`SIGKILL with ${ATTEMPTS} lost turn acknowledgements recovers exactly one session per attempt`,
	[fanoutCloudTrait(ATTEMPTS)],
	function* (daemon) {
		const first = yield* daemon.spawnHost();
		yield* first.until(() => Effect.succeed(first.url !== undefined));
		yield* first.until(() =>
			daemon.cloudRecords().pipe(
				Effect.map((stored) => ({
					done: daemon.cloudFanout().operations.size === ATTEMPTS,
					progress: stored.length + daemon.cloudFanout().sessions.length + daemon.cloudFanout().operations.size,
				})),
			),
		);
		const before = yield* daemon.cloudRecords();
		expect(before).toHaveLength(ATTEMPTS);
		expect(
			before.every(
				({ value }) => value.attempts.length === 1 && value.attempts[0]?.sessionId !== undefined && value.attempts[0]?.receipt === undefined,
			),
		).toBe(true);
		yield* first.kill;
		const readsDue = Math.max(...(yield* daemon.cloudRecords()).map(({ value }) => value.attempts[0]?.readRetry?.retryAt ?? 0));
		const restarted = yield* daemon.spawnHost();
		yield* restarted.until(() => Effect.succeed(restarted.url !== undefined));
		yield* Effect.sleep(Math.max(0, readsDue - (yield* Clock.currentTimeMillis)));
		yield* restarted.until(() =>
			daemon.cloudRecords().pipe(
				Effect.map((stored) => {
					const running = stored.filter(({ value }) => value.attempts[0]?.status === "running").length;
					const acknowledged = stored.filter(({ value }) => value.attempts[0]?.receipt !== undefined).length;
					return { done: stored.length === ATTEMPTS && running === ATTEMPTS, progress: acknowledged + running };
				}),
			),
		);
		yield* restarted.kill;
		const after = yield* daemon.cloudRecords();
		for (const { value } of after) {
			const [attempt] = value.attempts;
			expect(value.attempts).toHaveLength(1);
			expect(attempt?.operationId).toBe(before.find((stored) => stored.value.workId === value.workId)?.value.attempts[0]?.operationId);
			expect(attempt?.receipt).toEqual({ sessionId: attempt?.sessionId, turnId: `turn-${attempt?.sessionId}` });
		}
		expect(new Set(daemon.cloudFanout().operations.values()).size).toBe(ATTEMPTS);
		expect(daemon.cloudFanout().sessions).toHaveLength(ATTEMPTS);
		expect(daemon.cloudFanout().mutations.filter((method) => method === "thread/start")).toHaveLength(ATTEMPTS);
		expect(daemon.cloudFanout().mutations.filter((method) => method === "turn/start")).toHaveLength(ATTEMPTS);
	},
	0,
);
