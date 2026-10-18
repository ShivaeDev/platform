import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { renderStatus } from "#host/status.ts";
import { executing } from "#model.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { type EngineFixture, finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";
import { answerWorker, askWorker } from "#test/workerQuestion.ts";

const test = postgresTests("test", "isolated");

const openPullRequest = Effect.fn("BackPressureTest.openPullRequest")(function* (fixture: EngineFixture, workId: string) {
	fixture.approveWork(workId, `board-${workId}`);
	yield* prepareWork(workId);
	const fleet = yield* Fleet;
	yield* fleet.dispatch(workId);
	finishWorkers(fixture);
	const reviewed = yield* fleet.reconcile(workId);
	expect(reviewed.value).toMatchObject({ result: { kind: "change" }, stage: "needs-human" });
	expect(executing(reviewed.value)).toBe(false);
	return reviewed;
});

const prepareCandidates = Effect.fn("BackPressureTest.prepareCandidates")(function* (fixture: EngineFixture, count: number) {
	const ids = Array.from({ length: count }, (_unused, index) => `candidate-${index + 1}`);
	for (const id of ids) {
		fixture.approveWork(id, `board-${id}`);
		yield* prepareWork(id);
	}
	return ids;
});

const launchedOf = Effect.fn("BackPressureTest.launchedOf")(function* (ids: readonly string[]) {
	const fleet = yield* Fleet;
	const records = yield* Effect.forEach(ids, (id) => fleet.get(id));
	return records.filter(({ value }) => value.stage === "executing").map(({ value }) => value.workId);
});

const status = Effect.gen(function* () {
	return renderStatus(views((yield* (yield* Fleet).list()).map(({ value }) => value)));
});

describe("Fleet dispatch back pressure", () => {
	const curve = { concurrency: 4, openPullRequests: { ease: 1, floor: 0, max: 3 } } as const;
	for (const [open, allowed] of [
		[0, 4],
		[1, 4],
		[2, 2],
		[3, 0],
	] as const) {
		test(`${open} open Fleet PRs allow ${allowed} new implementer launches`, () =>
			withEngine({ backlog: 100, denyDelivery: true, ...curve }, (fixture) =>
				Effect.gen(function* () {
					for (let index = 1; index <= open; index += 1) {
						yield* openPullRequest(fixture, `pr-${index}`);
					}
					yield* fixture.foreign("human-pr");
					const candidates = yield* prepareCandidates(fixture, 4);
					yield* cycle;
					expect(yield* launchedOf(candidates)).toHaveLength(allowed);
					if (allowed < 4) {
						expect(yield* status).toContain(`waiting for open PRs to merge: ${open} of 3`);
					}
				}),
			));
	}

	test("merged PRs free new launches and urgent work launches over the curve", () => {
		const merged = new Set<string>();
		return withEngine(
			{
				backlog: 100,
				deliveryQuery: (result) => Effect.succeed(merged.has(result.head) ? { head: result.head, revision: "merged", url: result.pr } : undefined),
				...curve,
			},
			(fixture) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					const open = yield* Effect.forEach(["pr-1", "pr-2", "pr-3"], (id) => openPullRequest(fixture, id));
					const candidates = yield* prepareCandidates(fixture, 4);
					yield* cycle;
					expect(yield* launchedOf(candidates)).toEqual([]);
					fixture.priority("candidate-4", "urgent");
					yield* cycle;
					expect(yield* launchedOf(candidates)).toEqual(["candidate-4"]);
					expect((yield* fleet.get("candidate-4")).value.attempts.at(-1)?.overLimit).toBe(true);
					const head = open[0]?.value.result?.head ?? "missing";
					merged.add(head);
					expect((yield* fleet.reconcile("pr-1")).value.stage).toBe("completed");
					yield* cycle;
					expect(yield* launchedOf(candidates)).toEqual(["candidate-1", "candidate-4"]);
				}),
		);
	});

	test("review and repair launches proceed while new implementers are held", () =>
		withEngine({ concurrency: 3, denyDelivery: true, openPullRequests: { ease: 0, floor: 0, max: 1 }, repairs: true }, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* prepareWork("two");
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				const repairing = yield* fleet.reconcile("one");
				expect(repairing.value.attempts.map(({ role }) => role)).toEqual(["worker", "reviewer", "repair"]);
				expect(executing(repairing.value)).toBe(true);
				yield* cycle;
				expect((yield* fleet.get("two")).value).toMatchObject({
					attentionOwner: "automation",
					blocker: "waiting for open PRs to merge: 1 of 1",
					stage: "prepared",
				});
				finishWorkers(fixture);
				yield* cycle;
				const reviewed = (yield* fleet.get("one")).value;
				expect(reviewed.attempts.map(({ role }) => role)).toEqual(["worker", "reviewer", "repair", "reviewer"]);
				expect(reviewed.stage).toBe("needs-human");
				expect((yield* fleet.get("two")).value).toMatchObject({ attempts: [], stage: "prepared" });
			}),
		));

	test("an answered worker question continues while new implementers are held", () =>
		withFleetBoard({ concurrency: 3, denyDelivery: true, openPullRequests: { ease: 0, floor: 0, max: 1 } }, (fixture, root) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				for (const id of ["pr", "two"]) {
					boardHttpFiles(root).write(`${id}.md`, `---\nid: ${id}\nkind: task\nfleet: approved\n---\n# Work ${id}\n`);
				}
				yield* prepareWork("one");
				yield* prepareWork("pr");
				yield* fleet.dispatch("one");
				yield* fleet.dispatch("pr");
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("pr")).value).toMatchObject({ result: { kind: "change" }, stage: "needs-human" });
				const { decision } = yield* askWorker(fixture);
				yield* prepareWork("two");
				yield* fleet.dispatch("two").pipe(Effect.result);
				expect((yield* fleet.get("two")).value.blocker).toBe("waiting for open PRs to merge: 1 of 1");
				const answer = yield* answerWorker(root, decision);
				const continued = (yield* fleet.reconcile("one")).value;
				expect(continued.stage).toBe("executing");
				expect(continued.attempts.at(-1)?.prompt).toContain(answer.body);
				yield* cycle;
				expect((yield* fleet.get("two")).value).toMatchObject({ attempts: [], stage: "prepared" });
			}),
		));

	test("a review waiting for a slot goes before a new implementer", () =>
		withEngine({ concurrency: 1 }, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				yield* prepareWork("two");
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fixture.occupy("other-host");
				const waiting = (yield* fleet.reconcile("one")).value;
				expect(waiting).toMatchObject({ blocker: "execution capacity is occupied (limit 1)", stage: "reviewing" });
				yield* fixture.vacate("other-host");
				yield* fleet.dispatch("two").pipe(Effect.result);
				expect((yield* fleet.get("two")).value).toMatchObject({
					blocker: "waiting for 1 review or repair launches to go first (limit 1)",
					stage: "prepared",
				});
				yield* cycle;
				expect((yield* fleet.get("one")).value.attempts.at(-1)?.role).toBe("reviewer");
				expect((yield* fleet.get("two")).value.stage).toBe("prepared");
			}),
		));
});
