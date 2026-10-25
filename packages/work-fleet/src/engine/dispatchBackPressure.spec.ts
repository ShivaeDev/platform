import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { describe } from "vitest";
import { executing } from "#model.ts";
import {
	answerAtPullRequestLimitConfiguration,
	mergeablePullRequestCurve,
	openPullRequestCurve,
	repairAtPullRequestLimitConfiguration,
} from "#test/dispatchBackPressureTraits.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import { openFleetPullRequests, preparedCandidates } from "#test/engineDispatchTraits.ts";
import { engine, isolatedEngine } from "#test/engineStory.ts";
import { markdownWork, oneExecutionSlot } from "#test/engineTraits.ts";
import { QUESTION } from "#test/workerQuestion.ts";

const repairAtPullRequestLimit = engineConfiguration("repair at pull request limit", repairAtPullRequestLimitConfiguration());

const answerAtPullRequestLimit = engineConfiguration("answer at pull request limit", answerAtPullRequestLimitConfiguration());

describe("Fleet dispatch back pressure", () => {
	const curve = { concurrency: 4, openPullRequests: { ease: 1, floor: 0, max: 3 } } as const;
	for (const [open, allowed] of [
		[0, 4],
		[1, 4],
		[2, 2],
		[3, 0],
	] as const) {
		const openFleetPullRequestsTrait = engine.trait("work", `${open} Fleet PRs already await human delivery`, openFleetPullRequests(open));
		const fourApprovedCandidates = engine.trait("work", "four approved candidates are prepared", preparedCandidates(4));
		const openPullRequestCurveTrait = engineConfiguration("open pull request curve", openPullRequestCurve({ curve: () => curve }));
		isolatedEngine.it(
			`${open} open Fleet PRs allow ${allowed} new implementer launches`,
			[openPullRequestCurveTrait, openFleetPullRequestsTrait, fourApprovedCandidates],
			function* ({ reserveForeign, runningWorkIds, statusText, fleet, schedule }) {
				for (let index = 1; index <= open; index += 1) {
					const reviewed = (yield* fleet.get(`pr-${index}`)).value;
					expect(reviewed).toMatchObject({ result: { kind: "change" }, step: "waiting" });
					expect(executing(reviewed)).toBe(false);
				}
				yield* reserveForeign("human-pr");
				const candidates = ["candidate-1", "candidate-2", "candidate-3", "candidate-4"];
				yield* schedule();
				expect(yield* runningWorkIds(candidates)).toHaveLength(allowed);
				if (allowed < 4) {
					expect(yield* statusText()).toContain(`waiting for open PRs to merge: ${open} of 3`);
				}
			},
		);
	}

	{
		const merged = new Set<string>();
		const threePullRequestsAwaitingMerge = engine.trait("work", "three Fleet PRs already await human delivery", openFleetPullRequests(3));
		const fourApprovedCandidates = engine.trait("work", "four approved candidates are prepared", preparedCandidates(4));
		const mergeablePullRequestCurveTrait = engineConfiguration(
			"mergeable pull request curve",
			mergeablePullRequestCurve({ curve: () => curve, merged: () => merged }),
		);
		engine.it(
			"merged PRs free new launches and urgent work launches over the curve",
			[mergeablePullRequestCurveTrait, threePullRequestsAwaitingMerge, fourApprovedCandidates],
			function* ({ setPriority, runningWorkIds, fleet, schedule }) {
				const open = yield* Effect.forEach(["pr-1", "pr-2", "pr-3"], (id) => fleet.get(id));
				for (const reviewed of open) {
					expect(reviewed.value).toMatchObject({ result: { kind: "change" }, step: "waiting" });
					expect(executing(reviewed.value)).toBe(false);
				}
				const candidates = ["candidate-1", "candidate-2", "candidate-3", "candidate-4"];
				yield* schedule();
				expect(yield* runningWorkIds(candidates)).toEqual([]);
				setPriority("candidate-4", "urgent");
				yield* schedule();
				expect(yield* runningWorkIds(candidates)).toEqual(["candidate-4"]);
				expect((yield* fleet.get("candidate-4")).value.attempts.at(-1)?.overLimit).toBe(true);
				const head = open[0]?.value.result?.head ?? "missing";
				merged.add(head);
				expect((yield* fleet.reconcile("pr-1")).value.step).toBe("done");
				yield* schedule();
				expect(yield* runningWorkIds(candidates)).toEqual(["candidate-1", "candidate-4"]);
			},
		);
	}

	isolatedEngine.it(
		"review and repair launches proceed while new implementers are held",
		[repairAtPullRequestLimit],
		function* ({ finishWorkers, prepareWork, fleet, schedule }) {
			yield* prepareWork("one");
			yield* prepareWork("two");
			yield* fleet.dispatch("one");
			finishWorkers();
			const repairing = yield* fleet.reconcile("one");
			expect(repairing.value.attempts.map(({ role }) => role)).toEqual(["worker", "reviewer", "repair"]);
			expect(executing(repairing.value)).toBe(true);
			yield* schedule();
			expect((yield* fleet.get("two")).value).toMatchObject({
				attentionOwner: "automation",
				blocker: "waiting for open PRs to merge: 1 of 1",
				step: "queued",
			});
			finishWorkers();
			yield* schedule();
			const reviewed = (yield* fleet.get("one")).value;
			expect(reviewed.attempts.map(({ role }) => role)).toEqual(["worker", "reviewer", "repair", "reviewer"]);
			expect(reviewed.step).toBe("waiting");
			expect((yield* fleet.get("two")).value).toMatchObject({ attempts: [], step: "queued" });
		},
	);

	isolatedEngine.it(
		"an answered worker question continues while new implementers are held",
		[markdownWork(), answerAtPullRequestLimit],
		function* ({ writeBoardWork, answerWorker, workerQuestion, finishWorkers, prepareWork, fleet, schedule }) {
			for (const id of ["pr", "two"]) {
				writeBoardWork(`${id}.md`, `---\nid: ${id}\nkind: task\nfleet: approved\n---\n# Work ${id}\n`);
			}
			yield* prepareWork("one");
			yield* prepareWork("pr");
			yield* fleet.dispatch("one");
			yield* fleet.dispatch("pr");
			finishWorkers();
			expect((yield* fleet.reconcile("pr")).value).toMatchObject({ result: { kind: "change" }, step: "waiting" });
			yield* workerQuestion("one", QUESTION);
			const stopped = yield* fleet.reconcile("one");
			const decision = stopped.value.decision;
			if (decision?.published === undefined) {
				return yield* Effect.die("Missing published worker question");
			}
			yield* prepareWork("two");
			yield* fleet.dispatch("two").pipe(Effect.result);
			expect((yield* fleet.get("two")).value.blocker).toBe("waiting for open PRs to merge: 1 of 1");
			const answer = yield* answerWorker(decision);
			const continued = (yield* fleet.reconcile("one")).value;
			expect(continued.step).toBe("working");
			expect(continued.attempts.at(-1)?.prompt).toContain(answer.body);
			yield* schedule();
			expect((yield* fleet.get("two")).value).toMatchObject({ attempts: [], step: "queued" });
		},
	);

	isolatedEngine.it(
		"a review waiting for a slot goes before a new implementer",
		[oneExecutionSlot],
		function* ({ occupyExecution, vacateExecution, finishWorkers, prepareWork, fleet, schedule }) {
			yield* prepareWork("one");
			yield* prepareWork("two");
			yield* fleet.dispatch("one");
			finishWorkers();
			yield* occupyExecution("other-host");
			const waiting = (yield* fleet.reconcile("one")).value;
			expect(waiting).toMatchObject({ blocker: "execution capacity is occupied (limit 1)", step: "reviewing" });
			yield* vacateExecution("other-host");
			yield* fleet.dispatch("two").pipe(Effect.result);
			expect((yield* fleet.get("two")).value).toMatchObject({
				blocker: "waiting for 1 review or repair launches to go first (limit 1)",
				step: "queued",
			});
			yield* schedule();
			expect((yield* fleet.get("one")).value.attempts.at(-1)?.role).toBe("reviewer");
			expect((yield* fleet.get("two")).value.step).toBe("queued");
		},
	);
});
