import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { vi } from "vitest";
import { board as metadata } from "@shivaedev/work-board/integration/board.ts";
import { withBoardReadPass } from "#board/readPass.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { admitApproved, dispatchApproved } from "#host/admission.ts";
import { hostLayer } from "#host/commands.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("live");

for (const mode of ["scheduler", "dispatch"] as const) {
	for (const areas of ["areas: [other]", ""] as const) {
		test(`${mode} admits a prepared area waiter after its areas are ${areas === "" ? "removed" : "changed"}`, function* () {
			const one = task("one", "approved").replace("kind: task", "kind: task\nareas: [shared]");
			const two = one.replaceAll("one", "two");
			yield* withHost({ "one.md": one, "two.md": two }, {}, (fixture) =>
				Effect.gen(function* () {
					const fleet = yield* Fleet;
					yield* dispatchApproved(fixture.host, "one");
					yield* admitApproved(fixture.host);
					yield* cycle;
					const waiting = (yield* fleet.get("two")).value;
					expect(waiting).toMatchObject({ attempts: [], blocker: "waiting for area shared held by one", stage: "prepared" });
					const edited = two.replace("areas: [shared]", areas);
					fixture.write("two.md", edited);
					if (mode === "scheduler") {
						yield* admitApproved(fixture.host);
						yield* cycle;
					} else {
						yield* dispatchApproved(fixture.host, "two");
					}
					const launched = (yield* fleet.get("two")).value;
					expect(launched.stage).toBe("executing");
					expect(launched.areas ?? []).toEqual(areas === "" ? [] : ["other"]);
					expect(launched.blocker).toBeUndefined();
					expect(launched.attempts).toHaveLength(1);
					expect(launched.boardRevision).toBe(waiting.boardRevision);
					expect(launched.boardContext).toBe(edited);
					expect(launched.prompt).toContain(edited);
					expect((yield* fleet.get("one")).value.stage).toBe("executing");
					expect(fixture.provider.launched).toHaveLength(2);
				}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts))),
			);
		});
	}

	test(`${mode} uses edited dependencies for a prepared waiter`, function* () {
		const two = task("two", "approved");
		const dependent = two.replace("kind: task", "kind: task\nrelationships: [{ kind: depends_on, target: one }]");
		yield* withHost({ "one.md": task("one", "approved"), "two.md": dependent }, {}, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* dispatchApproved(fixture.host, "one");
				yield* admitApproved(fixture.host);
				yield* cycle;
				expect((yield* fleet.get("two")).value).toMatchObject({
					attempts: [],
					blocker: expect.stringContaining("waiting for dependency one"),
					stage: "prepared",
				});
				fixture.write("two.md", two);
				if (mode === "scheduler") {
					yield* admitApproved(fixture.host);
					yield* cycle;
				} else {
					yield* dispatchApproved(fixture.host, "two");
				}
				expect((yield* fleet.get("two")).value).toMatchObject({ boardContext: two, stage: "executing" });
				expect((yield* fleet.get("one")).value.stage).toBe("executing");
				expect(fixture.provider.launched).toHaveLength(2);
			}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts))),
		);
	});
}

test("scheduler passes leave an unchanged area wait unwritten", function* () {
	const one = task("one", "approved").replace("kind: task", "kind: task\nareas: [shared]");
	yield* withHost({ "one.md": one, "two.md": one.replaceAll("one", "two") }, {}, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* dispatchApproved(fixture.host, "one");
			yield* admitApproved(fixture.host);
			yield* cycle;
			const waiting = yield* fleet.get("two");
			expect(waiting.value).toMatchObject({ blocker: "waiting for area shared held by one", stage: "prepared" });
			yield* cycle;
			yield* cycle;
			expect(yield* fleet.get("two")).toEqual(waiting);
		}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts))),
	);
});

test("one scheduler pass parses each approved brief once to admit it and once to launch it", function* () {
	const ids = ["one", "two", "three"];
	yield* withHost(Object.fromEntries(ids.map((id) => [`${id}.md`, task(id, "approved")])), { concurrency: ids.length }, (fixture) =>
		Effect.gen(function* () {
			const parse = vi.spyOn(metadata, "metadataParse");
			yield* Effect.addFinalizer(() => Effect.sync(() => parse.mockRestore()));
			const result = yield* withBoardReadPass(admitApproved(fixture.host).pipe(Effect.andThen(cycle)));
			expect(result.dispatched.map((dispatch) => dispatch._tag)).toEqual(ids.map(() => "Success"));
			expect(fixture.provider.launched).toHaveLength(ids.length);
			expect(parse).toHaveBeenCalledTimes(ids.length * 2);
		}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts))),
	);
});
