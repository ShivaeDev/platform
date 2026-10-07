import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { revisionOf } from "@shivaedev/work-board/responses/records.ts";
import { Fleet } from "#fleet.ts";
import { boardHttpFiles, boardOverview } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);
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
			expect(yield* boardOverview(root)).toContain(`data-attention-item="${published.itemId}"`);
			const nextSource = `${source}\n## Approved revised scope\n\nInspect the next independent behavior.\n`;
			files.write("one.md", nextSource);
			fixture.approveWork("one", revisionOf(nextSource));
			const renewed = yield* prepareWork("one");
			expect(renewed.value.workId).toBe("one");
			expect(renewed.value.boardRevision).toBe(revisionOf(nextSource));
			expect(renewed.value.attempts).toEqual([]);
			expect(renewed.value.result).toBeUndefined();
			expect(renewed.value.history?.[0]?.attempts).toEqual(blocked.value.attempts);
			expect(renewed.value.history?.[0]?.boardContext).toBe(source);
			expect(renewed.value.history?.[0]?.decision?.published).toEqual(published);
			expect(renewed.value.history?.[0]?.decisionAcknowledged).toBe(true);
			expect(yield* boardOverview(root)).not.toContain(`data-attention-item="${published.itemId}"`);
			expect(files.receipts()).toHaveLength(1);
			expect(files.read(published.sourcePath)).toBe(question);
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
