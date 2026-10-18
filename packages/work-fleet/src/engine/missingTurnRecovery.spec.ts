import { expect } from "@effect/vitest";
import { lostAcknowledgement, publishedWork, recoveryFleet, unreadablePublication } from "#test/recoveryFleet.ts";
import { publicationRecoveryStory } from "#test/recoveryStories.ts";
import { WORK_BRANCH, WORK_PR } from "#test/workPublication.ts";

for (const published of ["branch", "pr"] as const) {
	recoveryFleet.it(
		`a visible ${published} permits repair when the other publication read fails`,
		[lostAcknowledgement(), publishedWork(published), unreadablePublication(published === "branch" ? "pr" : "branch")],
		function* ({ fleet, provider, fixture }) {
			yield* fleet.prepare();
			const initial = (yield* fleet.dispatch()).value;
			provider.lose(initial.attempts.at(-1)?.sessionId);
			const repaired = (yield* fleet.reconcile()).value;
			expect(repaired.stage).toBe("executing");
			expect(repaired.attempts.at(-1)?.role).toBe("repair");
			expect(repaired.attempts.at(-1)?.prompt).toContain(WORK_BRANCH);
			expect(fixture.decisions).toHaveLength(0);
			expect(fixture.launched).toHaveLength(2);
		},
	);
}

for (const acknowledgementLost of [false, true]) {
	for (const published of ["none", "branch", "pr"] as const) {
		recoveryFleet.it(
			`lost accepted turn ${acknowledgementLost ? "without" : "with"} a receipt recovers from ${published} after restart`,
			[publishedWork(published), ...(acknowledgementLost ? [lostAcknowledgement()] : [])],
			function* ({ fleet, provider, fixture }) {
				yield* fleet.prepare();
				const initial = (yield* fleet.dispatch()).value;
				provider.lose(initial.attempts.at(-1)?.sessionId);
				yield* fleet.restart();
				const recovered = (yield* fleet.reconcile()).value;
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
				yield* fleet.restart();
				expect((yield* fleet.reconcile()).value.attempts).toHaveLength(2);
			},
		);
	}
}

recoveryFleet.it(
	publicationRecoveryStory.name,
	[lostAcknowledgement(), unreadablePublication("branch")],
	function* ({ fleet, provider, publication, fixture }) {
		yield* fleet.prepare();
		const initial = (yield* fleet.dispatch()).value;
		provider.lose(initial.attempts.at(-1)?.sessionId);
		const waiting = (yield* fleet.reconcile()).value;
		expect(waiting.stage).toBe("needs-human");
		expect(waiting.decision?.code).toBe("session-turn-missing");
		expect(waiting.decision?.reason).toContain("observable");
		expect(fixture.launched).toHaveLength(1);
		const id = waiting.decision?.id;
		if (id === undefined) {
			throw new Error("Fleet did not publish a lost-turn decision");
		}
		fixture.respond(id, "retry");
		yield* fleet.restart();
		const unreadable = (yield* fleet.reconcile()).value;
		expect(unreadable.stage).toBe("needs-human");
		expect(unreadable.decision?.id).toBe(id);
		expect(fixture.decisions).toHaveLength(1);
		expect(fixture.launched).toHaveLength(1);
		publication.branch();
		publication.pullRequest();
		yield* fleet.restart();
		const repaired = (yield* fleet.reconcile()).value;
		expect(repaired.stage).toBe("executing");
		expect(repaired.decision).toBeUndefined();
		expect(repaired.attempts.at(-1)).toMatchObject({ role: "repair", status: "running" });
		expect(repaired.attempts.at(-1)?.sessionId).not.toBe(initial.attempts.at(-1)?.sessionId);
		expect(repaired.attempts.at(-1)?.prompt).toContain("Human context");
		expect(repaired.attempts.at(-1)?.prompt).toContain(WORK_PR);
		expect(repaired.responses).toMatchObject([{ action: "retry", boardAcknowledged: true }]);
		expect(fixture.launched).toHaveLength(2);
	},
);

recoveryFleet.it(
	"a release answer retires lost work without another submission",
	[lostAcknowledgement(), unreadablePublication("branch")],
	function* ({ fleet, provider, fixture }) {
		yield* fleet.prepare();
		provider.lose((yield* fleet.dispatch()).value.attempts.at(-1)?.sessionId);
		const waiting = (yield* fleet.reconcile()).value;
		expect(waiting.decision?.code).toBe("session-turn-missing");
		if (waiting.decision === undefined) {
			throw new Error("Fleet did not publish a lost-turn decision");
		}
		fixture.respond(waiting.decision.id, "release");
		yield* fleet.restart();
		const released = (yield* fleet.reconcile()).value;
		expect(released.stage).toBe("released");
		expect(released.responses).toMatchObject([{ action: "release", boardAcknowledged: true }]);
		expect(fixture.launched).toHaveLength(1);
	},
);
