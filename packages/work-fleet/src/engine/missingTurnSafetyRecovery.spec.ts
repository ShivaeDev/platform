import { expect } from "@effect/vitest";
import { recoveryFleet } from "#test/recoveryFleet.ts";
import { lostAcknowledgement } from "#test/recoveryTraits.ts";
import { WORK_BRANCH, WORK_PR } from "#test/workPublication.ts";

for (const receiptLost of [false, true]) {
	recoveryFleet.it(
		`a lost active thread ${receiptLost ? "without" : "with"} a receipt keeps its reservation through grace and asks instead of duplicating work`,
		receiptLost ? [lostAcknowledgement()] : [],
		function* ({ fleet, provider, observed, setTime, respond, status }) {
			yield* fleet.prepare();
			const first = (yield* fleet.dispatch()).value;
			const session = first.attempts.at(-1)?.sessionId;
			if (session === undefined) {
				throw new Error("Expected the accepted thread");
			}
			provider.lose(session);
			provider.active(session);
			const waiting = (yield* fleet.reconcile()).value;
			expect(waiting.stage).toBe("executing");
			expect(waiting.blocker).toContain("thread remains active");
			expect(yield* status()).toContain("Waiting on automation (1)");
			expect(observed.launched).toHaveLength(1);
			expect(observed.decisions).toEqual([]);
			yield* fleet.restart();
			setTime(300_099);
			expect((yield* fleet.reconcile()).value.stage).toBe("executing");
			setTime(300_100);
			const parked = (yield* fleet.reconcile()).value;
			expect(parked.decision?.reason).toContain("thread remains active after the visibility grace period");
			expect(observed.launched).toHaveLength(1);
			if (parked.decision === undefined) {
				throw new Error("Expected an active-thread decision");
			}
			respond(parked.decision.id, "release");
			expect((yield* fleet.reconcile()).value.stage).toBe("needs-human");
			respond(parked.decision.id, "retry");
			expect((yield* fleet.reconcile()).value.stage).toBe("needs-human");
			expect(observed.launched).toHaveLength(1);
			provider.idle(session);
			yield* fleet.restart();
			expect((yield* fleet.reconcile()).value.stage).toBe("executing");
			expect(observed.launched).toHaveLength(2);
		},
	);
}

for (const state of ["merged", "closed"] as const) {
	recoveryFleet.it(
		`a ${state} PR with its branch deleted prevents another lost-turn relaunch after recovery`,
		[lostAcknowledgement()],
		function* ({ fleet, provider, publication, observed, respond, setTime }) {
			yield* fleet.prepare();
			provider.lose((yield* fleet.dispatch()).value.attempts.at(-1)?.sessionId);
			const recovered = (yield* fleet.reconcile()).value;
			provider.lose(recovered.attempts.at(-1)?.sessionId);
			publication.pullRequest(state);
			yield* fleet.reconcile();
			setTime(300_100);
			yield* fleet.restart();
			const parked = (yield* fleet.reconcile()).value;
			expect(parked.stage).toBe("needs-human");
			expect(parked.decision?.reason).toContain(`is ${state}`);
			expect(observed.launched).toHaveLength(2);
			if (parked.decision === undefined) {
				throw new Error("Expected a delivery decision");
			}
			respond(parked.decision.id, "retry");
			yield* fleet.restart();
			expect((yield* fleet.reconcile()).value.stage).toBe("needs-human");
			expect(observed.launched).toHaveLength(2);
		},
	);
}

for (const receiptLost of [false, true]) {
	for (const published of ["none", "branch", "pr"] as const) {
		recoveryFleet.it(
			`repeated idle losses recheck ${published} publication after ${receiptLost ? "losing" : "receiving"} the first receipt`,
			receiptLost ? [lostAcknowledgement()] : [],
			function* ({ fleet, provider, publication, observed, setTime }) {
				yield* fleet.prepare();
				const first = (yield* fleet.dispatch()).value;
				provider.lose(first.attempts.at(-1)?.sessionId);
				yield* fleet.reconcile();
				setTime(300_100);
				let recovered = (yield* fleet.reconcile()).value;
				expect(observed.launched).toHaveLength(2);
				if (published === "branch") {
					publication.branch();
				} else if (published === "pr") {
					publication.pullRequest();
				}
				for (const submissions of [3, 4]) {
					provider.lose(recovered.attempts.at(-1)?.sessionId);
					yield* fleet.reconcile();
					setTime((submissions - 1) * 300_000 + 100);
					yield* fleet.restart();
					recovered = (yield* fleet.reconcile()).value;
					expect(recovered.stage).toBe("executing");
					expect(recovered.decision).toBeUndefined();
					expect(recovered.prompt).toBe(first.prompt);
					expect(recovered.attempts.at(-1)?.role).toBe(published === "none" ? "worker" : "repair");
					const prompt = observed.starts.at(-1)?.prompt;
					expect(prompt).toBe(recovered.attempts.at(-1)?.prompt);
					expect(prompt?.split(first.prompt)).toHaveLength(2);
					expect(prompt?.match(/Accepted Codex turn is not observable/gu)).toHaveLength(1);
					if (published !== "none") {
						expect(prompt).toContain(`existing branch ${WORK_BRANCH}`);
					}
					if (published === "pr") {
						expect(prompt).toContain(WORK_PR);
					}
					expect(observed.launched).toHaveLength(submissions);
				}
				expect(observed.decisions).toEqual([]);
			},
		);
	}
}
