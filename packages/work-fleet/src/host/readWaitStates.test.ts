import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import pg from "pg";
import { vi } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { readOnlySql } from "#host/readOnlySql.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
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
				const sql = yield* SqlClient.SqlClient;
				yield* sql`select 1`;
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
			}).pipe(Effect.provide(readOnlySql(fixture.host))),
		);
	}, 30_000);
});
