import { Effect } from "effect";
import { expect } from "vitest";
import { metadataParse } from "@shivaedev/work-board/metadata/parse.ts";
import { briefRevision } from "#board/briefRevision.ts";
import { Fleet } from "#fleet.ts";
import { acceptDependency } from "#test/acceptDependency.ts";
import { dependencySource, doneDependencySource, withDependencyBoard } from "#test/dependencyBoard.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");

for (const [field, source] of [
	["status", dependencySource.replace("status: planned", "status: deferred")],
	["next_action", dependencySource.replace("Implement the work.", "Work completed.")],
	["owner", dependencySource.replace("kind: task", "kind: task\nowner: next-owner")],
	["status and next_action", doneDependencySource],
] as const) {
	for (const noChange of [false, true]) {
		test(`editing ${field} on ${noChange ? "validated no-change" : "observed merge"} preserves dependency admission after restart`, () =>
			withDependencyBoard({ noChange }, (fixture, write) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const accepted = yield* acceptDependency(fixture);
					expect(accepted.value.stage).toBe("completed");
					write(source);
					yield* prepareWork("dependent");
					const launched = yield* fixture.restart(Effect.flatMap(Fleet, (fleet) => fleet.dispatch("dependent")));
					expect(launched.value.stage).toBe("executing");
					expect(launched.value.blocker).toBeUndefined();
					expect(briefRevision(metadataParse(source))).toBe(accepted.value.boardRevision);
				}),
			));
	}

	test(`editing target ${field} while its dependent executes still admits review`, () =>
		withDependencyBoard({ noChange: true }, (fixture, write) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* acceptDependency(fixture);
				yield* prepareWork("dependent");
				const fleet = yield* Fleet;
				expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
				write(source);
				finishWorkers(fixture);
				const completed = yield* fixture.restart(Effect.flatMap(Fleet, (restarted) => restarted.reconcile("dependent")));
				expect(completed.value.stage).toBe("completed");
				expect(completed.value.decision).toBeUndefined();
				expect(fixture.reviews).toHaveLength(2);
			}),
		));

	test(`editing target ${field} while its dependent reviews preserves completion`, () => {
		const options = { noChange: true, reviewRunning: false };
		return withDependencyBoard(options, (fixture, write) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* acceptDependency(fixture);
				yield* prepareWork("dependent");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("dependent");
				finishWorkers(fixture);
				options.reviewRunning = true;
				expect((yield* fleet.reconcile("dependent")).value.stage).toBe("reviewing");
				write(source);
				expect((yield* fleet.reconcile("dependent")).value.stage).toBe("reviewing");
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("dependent")).value.stage).toBe("completed");
			}),
		);
	});
}

for (const [edit, source] of [
	["criteria", doneDependencySource.replace("The behavior works.", "The changed behavior works.")],
	["body", doneDependencySource.replace("Implement the behavior.", "Implement different behavior.")],
] as const) {
	test(`completed target still blocks after editing ${edit}`, () =>
		withDependencyBoard({ noChange: true }, (fixture, write) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				yield* acceptDependency(fixture);
				write(source);
				yield* prepareWork("dependent");
				const fleet = yield* Fleet;
				expect(yield* fleet.dispatch("dependent").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
				expect((yield* fleet.get("dependent")).value.blocker).toContain("needs an accepted outcome");
			}),
		));
}

for (const changedAction of [false, true]) {
	test(`criteria aliased to next_action ${changedAction ? "block when their value changes" : "preserve acceptance when only status changes"}`, () =>
		withDependencyBoard({ noChange: true }, (fixture, write) =>
			Effect.gen(function* () {
				const source = dependencySource.replace("next_action: ", "next_action: &action ").replace("text: The behavior works.", "text: *action");
				write(source);
				yield* prepareWork("one");
				yield* acceptDependency(fixture);
				const done = source.replace("status: planned", "status: done");
				write(changedAction ? done.replace("Implement the work.", "Work completed.") : done);
				yield* prepareWork("dependent");
				const fleet = yield* Fleet;
				if (changedAction) {
					expect(yield* fleet.dispatch("dependent").pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
				} else {
					expect((yield* fleet.dispatch("dependent")).value.stage).toBe("executing");
				}
			}),
		));
}

for (const released of [false, true]) {
	test(`marking ${released ? "released" : "unfinished"} Fleet work done does not accept its dependency`, () =>
		withDependencyBoard({ checksFailure: released, noChange: true }, (fixture, write) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				if (released) {
					const failed = yield* acceptDependency(fixture);
					expect(failed.value.stage).toBe("needs-human");
					const decisionId = failed.value.decision?.id ?? "missing";
					const responseId = fixture.respond(decisionId, "release");
					expect((yield* fleet.resolve("one", decisionId, responseId)).value.stage).toBe("released");
				} else {
					expect((yield* fleet.dispatch("one")).value.stage).toBe("executing");
				}
				write(doneDependencySource);
				yield* prepareWork("dependent");
				yield* fleet.dispatch("dependent").pipe(Effect.flip);
				expect((yield* fleet.get("dependent")).value.stage).toBe("prepared");
				expect((yield* fleet.get("dependent")).value.blocker).toContain("needs an accepted outcome");
			}),
		));
}
