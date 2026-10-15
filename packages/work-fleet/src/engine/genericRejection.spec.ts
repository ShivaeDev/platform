import { expect } from "@effect/vitest";
import { Clock, Effect, Fiber } from "effect";
import { Fleet } from "#fleet.ts";
import { SessionTransport } from "#session/service.ts";
import { codexConfiguration, codexServer, WireRejection, type WireRequest } from "#test/codex.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { rejectionBackoff } from "#test/rejectionBackoff.ts";

const GENERIC = "Something went wrong. Request ID: synthetic-request";

const settled = Effect.gen(function* () {
	const fleet = yield* Fleet;
	while (true) {
		const current = (yield* fleet.get("one")).value;
		if (current.decision !== undefined || current.attempts[0]?.receipt !== undefined) {
			return current;
		}
		yield* Effect.yieldNow;
	}
});

for (const failures of [1, 3]) {
	postgresTests("test", "isolated")(`a generic protocol rejection retries the same request before asking: failures=${failures}`, function* () {
		const waits = failures === 1 ? ([0] as const) : ([0, 1] as const);
		const requests: WireRequest[] = [];
		const times: number[] = [];
		const clock = yield* Clock.Clock;
		const backoff = yield* rejectionBackoff;
		const server = yield* codexServer((request) => {
			requests.push(request);
			if (request.method === "thread/start") {
				return { thread: { id: "worker-thread" } };
			}
			if (request.method === "turn/start") {
				times.push(clock.currentTimeMillisUnsafe());
				return times.length <= failures ? new WireRejection(GENERIC) : { turn: { id: "worker-turn" } };
			}
			return { data: [], nextCursor: null };
		});
		yield* Effect.gen(function* () {
			const transport = yield* SessionTransport;
			yield* withEngine({ decorateTransport: () => transport, now: () => clock.currentTimeMillisUnsafe() }, (fixture) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* prepareWork("one");
					const dispatching = yield* fleet.dispatch("one").pipe(Effect.forkChild);
					for (const index of waits) {
						yield* Effect.raceFirst(backoff.advance(index), settled.pipe(Effect.map((early) => expect(early.decision).toBeUndefined())));
					}
					yield* Fiber.join(dispatching);
					const record = yield* settled;
					expect(record.attempts).toHaveLength(1);
					expect(record.attempts[0]?.sessionId).toBe("worker-thread");
					if (failures === 1) {
						expect(record.stage).toBe("executing");
						expect(record.attempts[0]?.receipt).toEqual({ sessionId: "worker-thread", turnId: "worker-turn" });
						expect(record.decision).toBeUndefined();
						expect(fixture.decisions).toHaveLength(0);
					} else {
						expect(record.stage).toBe("needs-human");
						expect(record.decision).toMatchObject({ code: "session-rejected", reason: `Codex rejected the protocol request: ${GENERIC}` });
						expect(fixture.decisions).toHaveLength(1);
					}
					expect(times).toEqual(failures === 1 ? [0, 30_000] : [0, 30_000, 90_000]);
					const submissions = requests.filter((request) => request.method === "turn/start");
					expect(submissions.map((request) => request.params)).toEqual(times.map(() => submissions[0]?.params));
					expect(requests.filter((request) => request.method === "thread/start")).toHaveLength(1);
				}),
			);
		}).pipe(Effect.provide(codexConfiguration(server.endpoint)), Effect.provideService(Clock.Clock, backoff.clock));
	});
}

for (const message of [
	"Invalid request",
	"Invalid params: unknown field",
	"Permission denied",
	"Permission required",
	"Quota exceeded",
	"Something went wrong. Permission denied. Request ID: synthetic-request",
]) {
	postgresTests("test", "isolated")(`a specific rejection asks immediately: ${message}`, function* () {
		let submissions = 0;
		const server = yield* codexServer((request) => {
			if (request.method === "thread/start") {
				return { thread: { id: "worker-thread" } };
			}
			if (request.method === "turn/start") {
				submissions += 1;
				return new WireRejection(message);
			}
			return { data: [{ id: "active", items: [], status: "inProgress" }], nextCursor: null };
		});
		yield* Effect.gen(function* () {
			const transport = yield* SessionTransport;
			yield* withEngine({ decorateTransport: () => transport }, (fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					const rejected = (yield* fleet.dispatch("one")).value;
					expect(rejected).toMatchObject({ decision: { reason: `Codex rejected the protocol request: ${message}` }, stage: "needs-human" });
					expect(fixture.decisions).toHaveLength(1);
					expect(submissions).toBe(1);
				}),
			);
		}).pipe(Effect.provide(codexConfiguration(server.endpoint)));
	});
}
