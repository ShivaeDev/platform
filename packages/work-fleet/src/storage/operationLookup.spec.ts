import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { operationRecord } from "#engine/operationRecord.ts";
import { SessionJournal } from "#session/service.ts";
import { namedAttempt, namedRecord } from "#test/namedCloudHost.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withOperationStorage } from "#test/withOperationStorage.ts";

const test = it.live.skipIf(storageDatabaseUrl === undefined);

test("projected operation lookup retains current and archived ambiguity without acknowledging either record", () =>
	withOperationStorage((store) =>
		Effect.gen(function* () {
			const current = namedRecord("current", [namedAttempt("worker")]);
			const { workId: _workId, ...cycle } = current;
			const archived = { ...namedRecord("archived", []), history: [{ ...cycle, archivedAt: 100 }] };
			yield* store.insert(current);
			yield* store.insert(archived);
			expect((yield* store.operationEntries("synthetic-worker")).map((entry) => entry.workId).sort()).toEqual(["archived", "current"]);
			expect(yield* operationRecord(store, "synthetic-worker")).toBeUndefined();
			const journal = yield* SessionJournal;
			expect(yield* journal.acknowledgeSession("synthetic-worker", "session").pipe(Effect.flip)).toMatchObject({ reason: "persistence" });
			expect(yield* store.load("current")).toEqual({ value: current, version: 1 });
			expect(yield* store.load("archived")).toEqual({
				value: archived,
				version: 1,
			});
		}),
	));

test("projection lookup reloads the owning record, preserves exact receipts and sees another writer introduce ambiguity", () =>
	withOperationStorage((store) =>
		Effect.gen(function* () {
			const first = yield* store.insert(namedRecord("one", [namedAttempt("worker")]));
			yield* store.insert(namedRecord("other", []));
			expect(yield* operationRecord(store, "synthetic-worker")).toEqual(first);
			const journal = yield* SessionJournal;
			yield* journal.acknowledgeSession("synthetic-worker", "session");
			const receipt = { sessionId: "session", turnId: "turn" };
			yield* journal.acknowledgeTurn("synthetic-worker", receipt);
			expect((yield* store.load("one"))?.value.attempts).toEqual([{ ...namedAttempt("worker"), receipt, sessionId: "session", status: "accepted" }]);
			expect(yield* journal.acknowledgeTurn("synthetic-worker", { ...receipt, turnId: "wrong" }).pipe(Effect.flip)).toMatchObject({
				reason: "persistence",
			});
			const other = yield* store.load("other");
			if (other === undefined) {
				return yield* Effect.die("Missing other record");
			}
			yield* store.compareAndSet("other", other.version, { ...other.value, attempts: [namedAttempt("worker")] });
			expect(yield* operationRecord(store, "synthetic-worker")).toBeUndefined();
			expect(yield* journal.acknowledgeTurn("synthetic-worker", receipt).pipe(Effect.flip)).toMatchObject({ reason: "persistence" });
			expect((yield* store.load("one"))?.version).toBe(3);
		}),
	));

test("operation lookup rejects a record changed after its projected ownership snapshot", () =>
	withOperationStorage((store) =>
		Effect.gen(function* () {
			const original = yield* store.insert(namedRecord("one", [namedAttempt("worker")]));
			const changed = { ...original.value, prompt: "Changed by another writer" };
			const racing = {
				...store,
				operationEntries: (operationId: string) =>
					store.operationEntries(operationId).pipe(Effect.tap(() => store.compareAndSet("one", original.version, changed).pipe(Effect.orDie))),
			};
			expect(yield* operationRecord(racing, "synthetic-worker")).toBeUndefined();
			expect(yield* store.load("one")).toEqual({ value: changed, version: 2 });
		}),
	));
