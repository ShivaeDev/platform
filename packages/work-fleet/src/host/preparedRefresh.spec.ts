import { expect } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { admitApproved, dispatchApproved } from "#host/admission.ts";
import { hostLayer } from "#host/commands.ts";
import { type MainSnapshot, MainSource } from "#host/mainSource.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("live");

for (const mode of ["admission", "dispatch", "edited dispatch"] as const) {
	test(`${mode} refreshes unlaunched preparation after main moves without archived cycles or decisions`, () =>
		withHost({ "one.md": task("one", "approved") }, {}, (fixture) => {
			let main: MainSnapshot = { observedAt: 1, revision: "main-0" };
			const source = Layer.succeed(MainSource)({
				current: Effect.sync(() => main),
				observe: (preparation) =>
					Effect.sync(() => ({
						...main,
						ancestor: true,
						changedPaths: preparation.baseRevision === main.revision ? [] : ["src/changed.ts"],
						complete: true,
						configurationChanges: [],
						fromRevision: preparation.baseRevision,
					})),
				refresh: Effect.sync(() => main),
				repositoryRoot: "/synthetic-repository",
			});
			return Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* admitApproved(fixture.host);
				const initial = (yield* fleet.get("one")).value;
				for (let revision = 1; revision <= (mode === "admission" ? 3 : 0); revision += 1) {
					main = { observedAt: revision + 1, revision: `main-${revision}` };
					expect(yield* admitApproved(fixture.host)).toEqual([]);
					const record = (yield* fleet.get("one")).value;
					expect(record.preparation).toEqual({ ...initial.preparation, baseRevision: main.revision, observedAt: main.observedAt });
					expect(record.boardRevision).toBe(initial.boardRevision);
					expect(record.stageEnteredAt).toBe(initial.stageEnteredAt);
					expect(record.attempts).toEqual([]);
				}
				expect((yield* fleet.get("one")).value.history ?? []).toEqual([]);
				main = { observedAt: 5, revision: "main-4" };
				if (mode === "edited dispatch") {
					fixture.write("one.md", task("one", "approved", "Edited criteria."));
				}
				const dispatched = (yield* dispatchApproved(fixture.host, "one")).value;
				expect(dispatched.stage).toBe("executing");
				expect(dispatched.decision).toBeUndefined();
				expect(dispatched.preparation.baseRevision).toBe(main.revision);
				expect(dispatched.history ?? []).toEqual([]);
				expect(fixture.provider.launched).toHaveLength(1);
			}).pipe(Effect.provide(hostLayer(fixture.host, { ...fixture.parts, main: source })));
		}));
}

for (const dispatch of ["scheduler", "explicit"] as const) {
	test(`${dispatch} picks up a queued brief moved to a free area without a decision`, () => {
		function inArea(id: string, area: string, body?: string) {
			return task(id, "approved", body).replace("kind: task", `kind: task\nareas: [${area}]`);
		}
		return withHost({ "one.md": inArea("one", "shared"), "two.md": inArea("two", "shared") }, {}, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* admitApproved(fixture.host);
				yield* dispatchApproved(fixture.host, "one");
				yield* cycle;
				const waiting = (yield* fleet.get("two")).value;
				expect(waiting.stage).toBe("prepared");
				expect(waiting.blocker).toContain("waiting for area shared");
				const edited = inArea("two", "free", "Edited criteria.").replace("fleet: approved", "fleet: approved\nfleet-launch:\n  model: edited-model");
				fixture.write("two.md", edited);
				if (dispatch === "scheduler") {
					expect(yield* admitApproved(fixture.host)).toEqual([]);
					yield* cycle;
				} else {
					yield* dispatchApproved(fixture.host, "two");
				}
				const launched = (yield* fleet.get("two")).value;
				expect(launched.stage).toBe("executing");
				expect(launched.areas).toEqual(["free"]);
				expect(launched.boardContext).toBe(edited);
				expect(launched.prompt).toBe(edited);
				expect(launched.attempts[0]?.settings?.model).toBe("edited-model");
				expect(launched.decision).toBeUndefined();
				expect(launched.blocker).toBeUndefined();
				expect(launched.history ?? []).toEqual([]);
				expect(fixture.provider.launched).toHaveLength(2);
			}).pipe(Effect.provide(hostLayer(fixture.host, fixture.parts))),
		);
	});
}
