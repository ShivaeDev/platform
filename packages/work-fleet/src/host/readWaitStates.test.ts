import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import pg from "pg";
import { vi } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
import { waitFor } from "#host/wait.ts";
import { watchFor } from "#host/watch.ts";
import { storeState, withHost } from "#test/fleetHost.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

describe("Fleet summary reads against PostgreSQL", () => {
	const test = it.live.skipIf(storageDatabaseUrl === undefined);

	test("100 items read in one query per poll without execution history", function* () {
		yield* withHost({}, {}, (fixture) =>
			Effect.gen(function* () {
				const ids = Array.from({ length: 100 }, (_, index) => `item-${index}`);
				for (const id of ids) {
					yield* storeState(fixture.host, id, { history: ["x".repeat(100_000)], stage: "executing" });
				}
				const query = vi.spyOn(pg.Client.prototype, "query");
				try {
					for (let poll = 0; poll < 2; poll += 1) {
						query.mockClear();
						const states = yield* readWaitStates(fixture.host, ids);
						expect(states).toHaveLength(100);
						expect(states[0]).toEqual({ outcome: {}, stage: "executing", workId: "item-0" });
						expect(query).toHaveBeenCalledTimes(1);
					}
				} finally {
					query.mockRestore();
				}
			}),
		);
	}, 30_000);

	test("watch and wait retry exactly twenty consecutive connection failures", function* () {
		const options = {
			databaseUrl: "postgresql://postgres:postgres@127.0.0.1:1/unavailable",
			intervalMs: 1,
			namespace: "unavailable",
		};
		const connect = vi.spyOn(pg.Client.prototype, "connect");
		try {
			expect(yield* watchFor({ ...options, workIds: ["unknown"] })).toBe(1);
			expect(connect).toHaveBeenCalledTimes(20);
			connect.mockClear();
			expect((yield* waitFor({ ...options, workId: "unknown" })).code).toBe(1);
			expect(connect).toHaveBeenCalledTimes(20);
		} finally {
			connect.mockRestore();
		}
	});
});
