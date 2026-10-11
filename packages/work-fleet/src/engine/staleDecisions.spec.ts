import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { revisionOf } from "@shivaedev/work-board/responses/records.ts";
import { Fleet } from "#fleet.ts";
import { boardHttp, boardHttpFiles, boardOverview } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { answerReport } from "#test/report.ts";
import { storageDatabaseUrl } from "#test/storage.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

const test = it.effect.skipIf(storageDatabaseUrl === undefined);

for (const status of ["planned", "done", "deferred"]) {
	test(`a Board HTTP release closes a changed and moved ${status} task decision without current approval`, () =>
		withFleetBoard({ checksFailure: true, noChange: true }, (fixture, root) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const decision = (yield* fleet.reconcile("one")).value.decision;
				if (decision?.published === undefined) {
					return yield* Effect.die("Missing decision");
				}
				const published = decision.published;
				const files = boardHttpFiles(root);
				files.write("one.md", `---\nid: one\nkind: task\nstatus: ${status}\n---\n# Changed scope\n`);
				files.move("one.md", "moved.md");
				const { client } = yield* boardHttp(root);
				const answer = yield* Effect.tryPromise(() =>
					client.mutate(
						client.responses.recordResponse.run({
							answers: [{ prompt: "fleet-action", selected: ["release"], text: "" }],
							author: "orchestrator",
							body: "Release ownership.",
							id: "response.changed.release",
							question: published.questionId,
							type: "answer",
						}),
					),
				);
				const released = yield* fleet.reconcile("one");
				expect(released.value.stage).toBe("released");
				expect(released.value.responses).toMatchObject([{ action: "release", boardAcknowledged: true, responseId: answer.id }]);
				expect(yield* boardOverview(root)).not.toContain(`data-attention-item="${published.itemId}"`);
				yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.resolve("one", decision.id, answer.id))));
				expect(files.receipts()).toHaveLength(1);
				expect(fixture.launched).toHaveLength(2);
			}),
		));
}

test("concurrent stale retries publish one current question, close the stale question and survive restart", () =>
	withFleetBoard({ checksFailure: true, noChange: true }, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const decision = (yield* fleet.reconcile("one")).value.decision;
			if (decision?.published === undefined) {
				return yield* Effect.die("Missing decision");
			}
			const files = boardHttpFiles(root);
			const currentSource = `${source}\nChanged scope.\n`;
			files.write("one.md", currentSource);
			const answer = answerReport(root, decision.published, "retry");
			yield* Effect.all(
				[fleet.resolve("one", decision.id, answer).pipe(Effect.result), fleet.resolve("one", decision.id, answer).pipe(Effect.result)],
				{ concurrency: "unbounded" },
			);
			const replacement = (yield* fleet.get("one")).value;
			expect(replacement.stage).toBe("needs-human");
			expect(replacement.boardRevision).toBe(revisionOf(source));
			expect(replacement.decision?.published?.workRevision).toBe(revisionOf(currentSource));
			expect(replacement.responses).toMatchObject([{ action: "retry", boardAcknowledged: true }]);
			const currentDecision = replacement.decision;
			const current = currentDecision?.published;
			if (current === undefined || currentDecision === undefined) {
				return yield* Effect.die("Missing replacement");
			}
			const page = yield* boardOverview(root);
			expect(page).not.toContain(`data-attention-item="${decision.published.itemId}"`);
			expect(page.match(/data-attention-item=/gu)).toHaveLength(1);
			expect(page).toContain(`data-attention-item="${current.itemId}"`);
			yield* fixture.replaceRecord({ ...replacement, decision: { ...currentDecision, published: undefined }, decisionPublished: false });
			yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.resolve("one", decision.id, answer))));
			expect((yield* fleet.get("one")).value.decision?.published).toEqual(current);
			const release = answerReport(root, current, "release");
			expect((yield* fleet.resolve("one", current.request, release)).value.stage).toBe("released");
			expect(yield* boardOverview(root)).not.toContain("data-attention-item=");
			expect(files.receipts()).toHaveLength(2);
			expect(fixture.launched).toHaveLength(2);
		}),
	));

test("an unambiguous worker answer still cannot continue changed work", () =>
	withFleetBoard({}, (fixture, root, source) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			const { decision } = yield* askWorker(fixture);
			yield* answerWorker(root, decision);
			boardHttpFiles(root).write("one.md", `${source}\nChanged scope.\n`);
			const stale = yield* fleet.reconcile("one");
			expect(stale.value.stage).toBe("needs-human");
			expect(stale.value.blocker).toContain("Board context changed");
			expect(stale.value.responses).toBeUndefined();
			expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(1);
		}),
	));
