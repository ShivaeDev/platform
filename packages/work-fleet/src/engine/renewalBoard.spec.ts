import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { Fleet } from "#fleet.ts";
import { boardAskFiles, boardHttpFiles } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = postgresTests("test");
test("new authored Board context renews SQL work and acknowledges its superseded question", () =>
	withFleetBoard({ checksFailure: true, noChange: true }, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			const files = boardHttpFiles(root);
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const blocked = yield* fleet.reconcile("one");
			const published = blocked.value.decision?.published;
			if (published === undefined) {
				return yield* Effect.die(new Error("Expected a published Board question"));
			}
			const question = files.read(published.sourcePath);
			expect(yield* boardAskFiles(root)).toContain(published.sourcePath);
			const nextSource = `${source}\n## Approved revised scope\n\nInspect the next independent behavior.\n`;
			files.write("one.md", nextSource);
			const renewed = yield* prepareWork("one");
			expect(renewed.value.workId).toBe("one");
			expect(renewed.value.boardRevision).toBe(briefRevision(metadataParse(nextSource)));
			expect(renewed.value.attempts).toEqual([]);
			expect(renewed.value.result).toBeUndefined();
			expect(renewed.value.history?.[0]?.attempts).toEqual(blocked.value.attempts.map((attempt) => ({ ...attempt, sessionCleanupComplete: true })));
			expect(renewed.value.history?.[0]?.boardContext).toBe(source);
			expect(renewed.value.history?.[0]?.decision?.published).toEqual(published);
			expect(renewed.value.history?.[0]?.decisionAcknowledged).toBe(true);
			expect(yield* boardAskFiles(root)).not.toContain(published.sourcePath);
			expect(files.receipts()).toHaveLength(1);
			const closed = metadataParse(files.read(published.sourcePath));
			expect(closed.fields.attention).toMatchObject([{ state: "closed" }]);
			expect(closed.body).toBe(metadataParse(question).body);
			expect(files.read("one.md")).toBe(nextSource);
			yield* fixture.restart(
				Effect.gen(function* () {
					const restarted = yield* Fleet;
					const restored = yield* restarted.get("one");
					expect(restored.value.history).toEqual(renewed.value.history);
					expect(restored.value.boardContext).toBe(nextSource);
					expect(restored.value.attempts).toEqual([]);
				}),
			);
			expect(files.receipts()).toHaveLength(1);
			expect(fixture.launched).toHaveLength(2);
		}),
	));
