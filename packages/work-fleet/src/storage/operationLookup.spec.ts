import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { operationRecord } from "#engine/operationRecord.ts";
import { SessionJournal } from "#session/service.ts";
import { namedAttempt, namedRecord } from "#test/namedCloudHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withOperationStorage } from "#test/withOperationStorage.ts";

const test = postgresTests("live");

test("projected operation lookup retains current and archived ambiguity without acknowledging either record", () =>
	withOperationStorage((store) =>
		Effect.gen(function* () {
			const current = namedRecord("current", [namedAttempt("worker")]);
			const { workId: _workId, ...cycle } = current;
			const archived = { ...namedRecord("archived", []), history: [{ ...cycle, archivedAt: 100 }] };
			const savedCurrent = yield* store.insert(current);
			const savedArchived = yield* store.insert(archived);
			expect((yield* store.operationEntries("synthetic-worker")).map((entry) => entry.workId).sort()).toEqual(["archived", "current"]);
			expect(yield* operationRecord(store, "synthetic-worker")).toBeUndefined();
			const journal = yield* SessionJournal;
			expect(yield* journal.acknowledgeSession("synthetic-worker", "session").pipe(Effect.flip)).toMatchObject({ reason: "persistence" });
			expect(yield* store.load("current")).toEqual(savedCurrent);
			expect(yield* store.load("archived")).toEqual(savedArchived);
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
			let saved = original;
			function snapshot(operationId: string) {
				return Effect.gen(function* () {
					const entries = yield* store.operationEntries(operationId);
					saved = yield* store.compareAndSet("one", original.version, changed);
					return entries;
				}).pipe(Effect.orDie);
			}
			const racing = { ...store, operationEntries: snapshot };
			expect(yield* operationRecord(racing, "synthetic-worker")).toBeUndefined();
			expect(yield* store.load("one")).toEqual(saved);
		}),
	));
