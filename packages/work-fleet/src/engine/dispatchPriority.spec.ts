import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { boardHttpFiles } from "#test/boardHttp.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";
import { withFleetBoard } from "#test/withFleetBoard.ts";

const test = postgresTests("test", "isolated");

function task(id: string, priority: string) {
	return `---\nid: ${id}\nkind: task\nfleet: approved\nfleet-priority: ${priority}\n---\n# Work ${id}\n`;
}

const stages = Effect.fn("PriorityTest.stages")(function* (ids: readonly string[]) {
	const fleet = yield* Fleet;
	return Object.fromEntries(yield* Effect.forEach(ids, (id) => fleet.get(id).pipe(Effect.map(({ value }) => [id, value.step]))));
});

describe("Fleet dispatch priority", () => {
	test("dispatch now launches at full concurrency while a normal dispatch waits", () =>
		withEngine({ concurrency: 1 }, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				fixture.approveWork("three", "board-three");
				for (const id of ["one", "two", "three"]) {
					yield* prepareWork(id);
				}
				yield* fleet.dispatch("one");
				yield* fleet.dispatch("two").pipe(Effect.result);
				const urgent = yield* fleet.dispatch("three", undefined, { ignoreAreas: false });
				expect(urgent.value.attempts.at(-1)).toMatchObject({ overLimit: true, role: "worker" });
				yield* cycle;
				expect(yield* stages(["one", "two", "three"])).toEqual({ one: "working", three: "working", two: "queued" });
				expect((yield* fleet.get("two")).value.blocker).toBe("execution capacity is occupied (limit 1)");
				const status = renderStatus(views((yield* fleet.list()).map(({ value }) => value)));
				expect(status).toContain("three  working  launched over the limit");
				expect(status).not.toContain("one  working  launched over the limit");
			}),
		));

	test("urgent work still waits for a held area unless dispatch ignores areas", () =>
		withEngine({ concurrency: 1 }, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				fixture.approveWork("three", "board-three");
				fixture.areas("one", ["work-fleet/scheduler"]);
				fixture.areas("two", ["work-fleet/scheduler"]);
				fixture.areas("three", ["work-board/ui"]);
				fixture.priority("two", "urgent");
				fixture.priority("three", "urgent");
				for (const id of ["one", "two", "three"]) {
					yield* prepareWork(id);
				}
				yield* fleet.dispatch("one");
				yield* cycle;
				expect(yield* stages(["one", "two", "three"])).toEqual({ one: "working", three: "working", two: "queued" });
				expect((yield* fleet.get("two")).value.blocker).toBe("waiting for area work-fleet/scheduler held by one");
				const forced = yield* fleet.dispatch("two", undefined, { ignoreAreas: true });
				expect(forced.value.attempts.at(-1)).toMatchObject({ overLimit: true, role: "worker" });
			}),
		));

	test("a dispatch now request waiting for an area launches over the limit once the area frees", () =>
		withEngine({ concurrency: 1 }, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				fixture.approveWork("three", "board-three");
				fixture.areas("one", ["work-fleet/scheduler"]);
				fixture.areas("two", ["work-fleet/scheduler"]);
				for (const id of ["one", "two", "three"]) {
					yield* prepareWork(id);
				}
				yield* fleet.dispatch("one");
				yield* fleet.dispatch("two", undefined, { ignoreAreas: false }).pipe(Effect.result);
				expect((yield* fleet.get("two")).value).toMatchObject({
					blocker: "waiting for area work-fleet/scheduler held by one",
					dispatchNow: { ignoreAreas: false },
					step: "queued",
				});
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value.step).toBe("done");
				yield* fleet.dispatch("three");
				const launched = yield* fleet.dispatch("two");
				expect(launched.value.attempts.at(-1)).toMatchObject({ overLimit: true, role: "worker" });
				expect(yield* stages(["two", "three"])).toEqual({ three: "working", two: "working" });
			}),
		));

	test("dispatch now still waits for an unfinished dependency", () =>
		withEngine({ concurrency: 1 }, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("dependent");
				yield* prepareWork("one");
				yield* fleet.dispatch("dependent", undefined, { ignoreAreas: true }).pipe(Effect.result);
				expect((yield* fleet.get("dependent")).value).toMatchObject({ attempts: [], dispatchNow: { ignoreAreas: true }, step: "queued" });
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value.step).toBe("done");
				expect((yield* fleet.dispatch("dependent")).value.step).toBe("working");
			}),
		));

	test("high priority work is admitted before normal work when slots are short", () =>
		withEngine({ concurrency: 1 }, (fixture) =>
			Effect.gen(function* () {
				for (const id of ["three", "four"]) {
					fixture.approveWork(id, `board-${id}`);
				}
				fixture.priority("three", "high");
				fixture.priority("four", "high");
				for (const id of ["one", "two", "three", "four"]) {
					yield* prepareWork(id);
				}
				yield* cycle;
				expect(yield* stages(["one", "two", "three", "four"])).toEqual({
					four: "queued",
					one: "queued",
					three: "working",
					two: "queued",
				});
			}),
		));

	test("Board frontmatter priority orders admission and rejects unknown values", () =>
		withFleetBoard({ concurrency: 1 }, (_fixture, root) =>
			Effect.gen(function* () {
				const files = boardHttpFiles(root);
				files.write("two.md", task("two", "normal"));
				files.write("three.md", task("three", "high"));
				files.write("four.md", task("four", "soon"));
				for (const id of ["one", "two", "three"]) {
					yield* prepareWork(id);
				}
				const invalid = yield* prepareWork("four").pipe(Effect.flip);
				expect(invalid.message).toContain("Invalid fleet-priority; use urgent, high, normal or low, or omit the field.");
				yield* cycle;
				expect(yield* stages(["one", "two", "three"])).toEqual({ one: "queued", three: "working", two: "queued" });
			}),
		));
});
