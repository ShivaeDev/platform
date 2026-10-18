import { expect } from "@effect/vitest";
import { recoveryFleet } from "#test/recoveryFleet.ts";
import { lostAcknowledgement, publishedWork } from "#test/recoveryTraits.ts";

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
		`a ${state} PR with its branch deleted prevents a lost-turn relaunch`,
		[lostAcknowledgement()],
		function* ({ fleet, provider, publication, observed, respond }) {
			yield* fleet.prepare();
			provider.lose((yield* fleet.dispatch()).value.attempts.at(-1)?.sessionId);
			publication.pullRequest(state);
			const parked = (yield* fleet.reconcile()).value;
			expect(parked.stage).toBe("needs-human");
			expect(parked.decision?.reason).toContain(`is ${state}`);
			expect(observed.launched).toHaveLength(1);
			if (parked.decision === undefined) {
				throw new Error("Expected a delivery decision");
			}
			respond(parked.decision.id, "retry");
			yield* fleet.restart();
			expect((yield* fleet.reconcile()).value.stage).toBe("needs-human");
			expect(observed.launched).toHaveLength(1);
		},
	);
}

for (const published of ["none", "pr"] as const) {
	recoveryFleet.it(
		`a second lost turn with ${published} asks after one automatic relaunch and keeps the original brief`,
		[lostAcknowledgement(), publishedWork(published)],
		function* ({ fleet, provider, observed, setTime, respond }) {
			yield* fleet.prepare();
			const first = (yield* fleet.dispatch()).value;
			provider.lose(first.attempts.at(-1)?.sessionId);
			const recovered = (yield* fleet.reconcile()).value;
			expect(recovered.prompt).toBe(first.prompt);
			expect(recovered.attempts.at(-1)?.prompt?.split(first.prompt)).toHaveLength(2);
			expect(observed.starts.at(-1)?.prompt).toBe(recovered.attempts.at(-1)?.prompt);
			provider.lose(recovered.attempts.at(-1)?.sessionId);
			yield* fleet.reconcile();
			setTime(300_100);
			yield* fleet.restart();
			const parked = (yield* fleet.reconcile()).value;
			expect(parked.stage).toBe("needs-human");
			expect(parked.decision?.reason).toContain("one automatic relaunch");
			expect(observed.launched).toHaveLength(2);
			if (parked.decision === undefined) {
				throw new Error("Expected a repeated-loss decision");
			}
			respond(parked.decision.id, "retry");
			const answered = (yield* fleet.reconcile()).value;
			expect(answered.stage).toBe("executing");
			expect(answered.prompt).toBe(first.prompt);
			expect(answered.attempts.at(-1)?.prompt?.split(first.prompt)).toHaveLength(2);
			expect(answered.attempts.at(-1)?.prompt?.match(/Accepted Codex turn is not observable/gu)).toHaveLength(1);
			expect(answered.attempts.at(-1)?.prompt).toContain("Human context");
			expect(observed.launched).toHaveLength(3);
		},
	);
}
