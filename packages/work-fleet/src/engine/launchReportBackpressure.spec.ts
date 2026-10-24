import { describe, expect } from "@effect/vitest";
import { views } from "#engine/views.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { engine } from "#test/engineStory.ts";
import { queuedReportWork } from "#test/queuedReportWork.ts";

describe("report launch backpressure", () => {
	const queuedReportWorkTrait = engineConfiguration("report work starts while the provider queue is full", queuedReportWork());
	engine.it(
		"a queued report retains its report prompt through restart and publishes its result",
		[queuedReportWorkTrait],
		function* ({
			providerObservations,
			launches,
			reviewedHeads,
			advanceTime,
			recoverProvider,
			finishWorkers,
			prepareWork,
			restart,
			fleet,
			schedule,
		}) {
			yield* prepareWork("one");
			yield* schedule();
			const queued = (yield* fleet.get("one")).value;
			expect(queued.attentionOwner).toBe("automation");
			expect(queued).toMatchObject({ deliverable: "report", step: "queued" });
			recoverProvider();
			advanceTime(29_999);
			yield* restart();
			yield* schedule();
			expect(launches()).toHaveLength(1);
			advanceTime(1);
			yield* restart();
			yield* schedule();
			expect(launches()).toHaveLength(2);
			const [observation] = providerObservations();
			expect(observation?.output).toBe(queued.attempts[0]?.prompt);
			expect(observation?.output).toContain("Leave repository sources unchanged. Commit nothing, push nothing, and open no PR.");
			expect(observation?.output).toContain("Never publish attachments to git or GitHub.");
			expect(observation?.output).toContain("Follow synthetic report conventions.");
			finishWorkers();
			const completed = (yield* fleet.reconcile("one")).value;
			expect(completed.step).toBe("done");
			expect(completed.launchRetry).toBeUndefined();
			expect(completed.report?.receipt).toEqual(observation?.receipt);
			expect(views([completed]).completed[0]?.links).toEqual([completed.report?.sourcePath]);
			expect(reviewedHeads()).toEqual([]);
		},
	);
});
