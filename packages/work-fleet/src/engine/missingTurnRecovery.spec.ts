import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { lostTurnProvider } from "#test/lostTurnProvider.ts";
import { postgresTests } from "#test/postgres.ts";
import { WORK_BRANCH, WORK_PR, workPublication } from "#test/workPublication.ts";

const test = postgresTests("test");

for (const published of ["branch", "pr"] as const) {
	test(`a visible ${published} permits repair when the other publication read fails`, function* () {
		const provider = lostTurnProvider();
		const publication = workPublication();
		if (published === "branch") {
			publication.branch();
			publication.pullsUnavailable();
		} else {
			publication.pullRequest();
			publication.unavailable();
		}
		yield* withEngine({ decorateTransport: provider.decorate, lostAcknowledgement: true, publicationQuery: publication.query }, (fixture) =>
			Effect.gen(function* () {
				const fleet = yield* Fleet;
				yield* prepareWork("one");
				const initial = (yield* fleet.dispatch("one")).value;
				provider.lose(initial.attempts.at(-1)?.sessionId);
				const repaired = (yield* fleet.reconcile("one")).value;
				expect(repaired.stage).toBe("executing");
				expect(repaired.attempts.at(-1)?.role).toBe("repair");
				expect(repaired.attempts.at(-1)?.prompt).toContain(WORK_BRANCH);
				expect(fixture.decisions).toHaveLength(0);
				expect(fixture.launched).toHaveLength(2);
			}),
		);
	});
}

for (const acknowledgementLost of [false, true]) {
	for (const published of ["none", "branch", "pr"] as const) {
		test(`lost accepted turn ${acknowledgementLost ? "without" : "with"} a receipt recovers from ${published} after restart`, function* () {
			const provider = lostTurnProvider();
			const publication = workPublication();
			if (published === "branch") {
				publication.branch();
			} else if (published === "pr") {
				publication.pullRequest();
			} else {
				publication.neighbour();
			}
			yield* withEngine(
				{ decorateTransport: provider.decorate, lostAcknowledgement: acknowledgementLost, publicationQuery: publication.query },
				(fixture) =>
					Effect.gen(function* () {
						const fleet = yield* Fleet;
						yield* prepareWork("one");
						const initial = (yield* fleet.dispatch("one")).value;
						provider.lose(initial.attempts.at(-1)?.sessionId);
						const recovered = (yield* fixture.restart(fleet.reconcile("one"))).value;
						expect(recovered.stage).toBe("executing");
						expect(recovered.decision).toBeUndefined();
						expect(fixture.decisions).toHaveLength(0);
						expect(fixture.launched).toHaveLength(2);
						expect(fixture.settings.filter((call) => call.call === "turn")).toHaveLength(2);
						expect(recovered.attempts[0]).toMatchObject({ sessionUnusable: true, status: "failed" });
						expect(recovered.attempts[0]?.output).toContain("Accepted Codex turn is not observable");
						expect(recovered.attempts.at(-1)?.role).toBe(published === "none" ? "worker" : "repair");
						if (published === "none") {
							expect(recovered.releaseReason).toContain("release and relaunch");
						} else {
							expect(recovered.attempts.at(-1)?.prompt).toContain(`existing branch ${WORK_BRANCH}`);
						}
						if (published === "pr") {
							expect(recovered.attempts.at(-1)?.prompt).toContain(WORK_PR);
						}
						expect((yield* fixture.restart(fleet.reconcile("one"))).value.attempts).toHaveLength(2);
					}),
			);
		});
	}
}

test("an answer to a lost-turn question starts repair on its published PR and carries the answer", function* () {
	const provider = lostTurnProvider();
	const publication = workPublication();
	publication.unavailable();
	yield* withEngine({ decorateTransport: provider.decorate, lostAcknowledgement: true, publicationQuery: publication.query }, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			const initial = (yield* fleet.dispatch("one")).value;
			provider.lose(initial.attempts.at(-1)?.sessionId);
			const waiting = (yield* fleet.reconcile("one")).value;
			expect(waiting.stage).toBe("needs-human");
			expect(waiting.decision?.reason).toContain("observable");
			expect(fixture.launched).toHaveLength(1);
			const id = waiting.decision?.id ?? "missing";
			fixture.respond(id, "retry");
			const unreadable = (yield* fleet.reconcile("one")).value;
			expect(unreadable.stage).toBe("needs-human");
			expect(unreadable.decision?.id).toBe(id);
			expect(fixture.decisions).toHaveLength(1);
			expect(fixture.launched).toHaveLength(1);
			publication.branch();
			publication.pullRequest();
			const repaired = (yield* fixture.restart(fleet.reconcile("one"))).value;
			expect(repaired.stage).toBe("executing");
			expect(repaired.decision).toBeUndefined();
			expect(repaired.attempts.at(-1)).toMatchObject({ role: "repair", status: "running" });
			expect(repaired.attempts.at(-1)?.prompt).toContain("Human context");
			expect(repaired.attempts.at(-1)?.prompt).toContain(WORK_PR);
			expect(repaired.responses).toMatchObject([{ action: "retry", boardAcknowledged: true }]);
			expect(fixture.launched).toHaveLength(2);
		}),
	);
});
