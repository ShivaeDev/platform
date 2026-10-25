import { Effect } from "effect";
import { describe, expect } from "vitest";
import { Fleet } from "#fleet.ts";
import { engine } from "#test/engineStory.ts";
import { lostReportPublication } from "#test/lostReportPublication.ts";

const reconcileReport = Fleet.pipe(Effect.flatMap((fleet) => fleet.reconcile("one")));
describe("report publication recovery", () => {
	engine.it(
		"safe release allows renewal without adopting a PR or losing the archived report output",
		[lostReportPublication(false)],
		function* ({ answerReportDecision, reportPublicationCount, workerReports, fleet, prepareWork, launches }) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			workerReports("Archived findings.");
			const failed = yield* fleet.reconcile("one");
			const decision = failed.value.decision?.published;
			if (decision === undefined) {
				return yield* Effect.die(new Error("Report publication failure needs a Board decision"));
			}
			answerReportDecision(decision, "release");
			expect((yield* fleet.reconcile("one")).value.step).toBe("released");
			const renewed = yield* prepareWork("one");
			expect(renewed.value.step).toBe("queued");
			expect(renewed.value.history?.[0]?.attempts[0]?.output).toBe("Archived findings.");
			expect(launches()).toHaveLength(1);
			expect(reportPublicationCount()).toBe(1);
		},
	);
	engine.it(
		"retries a lost publication receipt after restart with unavailable retrieval and no changed bytes, result or worker",
		[lostReportPublication(true)],
		function* ({
			reportFiles,
			readReport,
			answerReportDecision,
			loseReportRetrieval,
			reportPublicationCount,
			attachmentCollections,
			workerReports,
			fleet,
			prepareWork,
			afterRestart,
			launches,
			reviewedHeads,
			mergedHeads,
		}) {
			yield* prepareWork("one");

			yield* fleet.dispatch("one");
			workerReports("# Complete findings\n\nEvidence.\n");
			const failed = yield* fleet.reconcile("one");
			expect(failed.value.step).toBe("waiting");
			const renewal = yield* prepareWork("one").pipe(Effect.flip);
			expect(renewal.message).toContain("Reconcile the report before renewing");
			const [resultFile] = reportFiles();
			expect(resultFile).toBeDefined();
			const bytes = readReport(resultFile ?? "missing");
			const decision = failed.value.decision?.published;
			if (decision === undefined) {
				return yield* Effect.die(new Error("Report publication failure needs a Board decision"));
			}
			answerReportDecision(decision, "retry");
			loseReportRetrieval();
			const completed = yield* afterRestart(reconcileReport);
			expect({ blocker: completed.value.blocker, decision: completed.value.decision?.reason, step: completed.value.step }).toEqual({
				blocker: undefined,
				decision: undefined,
				step: "done",
			});
			expect(reportPublicationCount()).toBe(2);
			expect(attachmentCollections()).toBe(1);
			yield* fleet.reconcile("one");
			expect(reportPublicationCount()).toBe(2);
			expect(launches()).toHaveLength(1);
			expect(reviewedHeads()).toEqual([]);
			expect(mergedHeads()).toEqual([]);
			expect(reportFiles()).toEqual([resultFile]);
			expect(readReport(resultFile ?? "missing")).toBe(bytes);
		},
	);
});
