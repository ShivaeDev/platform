import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { migrateFleet } from "#storage/migrateFleet.ts";
import { storageDatabaseUrl, withStorage } from "#test/storage.ts";

const test = it.live.skipIf(storageDatabaseUrl === undefined);

test("migration persists owners on existing waits and preserves assigned owners and active records", () =>
	withStorage((_store, namespace) =>
		Effect.gen(function* () {
			const sql = yield* SqlClient.SqlClient;
			yield* sql`delete from ${sql(`${namespace}_migrations`)} where migration_id = 4`;
			const payloads = [
				{ stage: "needs-human", workId: "question" },
				{ blocker: "execution capacity is occupied (limit 1)", stage: "prepared", workId: "blocked" },
				{ blocker: "waiting for area fleet/host held by one", stage: "prepared", workId: "area" },
				{ blocker: "Fresh available provider quota is required", stage: "prepared", workId: "quota" },
				{ decision: { published: { request: "original" } }, stage: "needs-human", workId: "published" },
				{ decision: { reason: "Reviewed PR is ready to merge" }, stage: "needs-human", workId: "ready" },
				{ checks: { pending: true }, stage: "validating", workId: "checks" },
				{ attentionOwner: "maintainer", stage: "needs-human", workId: "assigned" },
				{ stage: "executing", workId: "active" },
			];
			for (const payload of payloads) {
				yield* sql`insert into ${sql(`${namespace}_records`)} (work_id, version, payload) values (${payload.workId}, 1, ${JSON.stringify(payload)}::jsonb)`;
			}
			yield* migrateFleet(namespace);
			const rows = yield* sql<{
				readonly owner: string | null;
				readonly decisionOwner: string | null;
				readonly version: number;
				readonly workId: string;
			}>`select work_id as "workId", version, payload->>'attentionOwner' as owner, payload->'decision'->>'attentionOwner' as "decisionOwner" from ${sql(`${namespace}_records`)} order by work_id`;
			expect(rows).toEqual([
				{ decisionOwner: null, owner: null, version: 1, workId: "active" },
				{ decisionOwner: null, owner: "automation", version: 2, workId: "area" },
				{ decisionOwner: null, owner: "maintainer", version: 1, workId: "assigned" },
				{ decisionOwner: null, owner: "automation", version: 2, workId: "blocked" },
				{ decisionOwner: null, owner: "automation", version: 2, workId: "checks" },
				{ decisionOwner: "maintainer", owner: "maintainer", version: 2, workId: "published" },
				{ decisionOwner: null, owner: "orchestrator", version: 2, workId: "question" },
				{ decisionOwner: null, owner: "automation", version: 2, workId: "quota" },
				{ decisionOwner: "maintainer", owner: "maintainer", version: 2, workId: "ready" },
			]);
			yield* migrateFleet(namespace);
			expect((yield* sql`select version from ${sql(`${namespace}_records`)} where work_id = 'question'`)[0]?.version).toBe(2);
		}),
	));
