import { expect } from "@effect/vitest";
import { recoveryFleet } from "#test/recoveryFleet.ts";
import { lostAcknowledgement, publishedWork } from "#test/recoveryTraits.ts";
import { WORK_PR } from "#test/workPublication.ts";

for (const published of ["none", "pr"] as const) {
	recoveryFleet.it(
		`a lost ${published} turn keeps its intent until quota admits its replacement after restart`,
		[lostAcknowledgement(), publishedWork(published)],
		function* ({ fleet, provider, observed, quota }) {
			yield* fleet.prepare();
			const initial = (yield* fleet.dispatch()).value;
			provider.lose(initial.attempts.at(-1)?.sessionId);
			quota(1);
			const blocked = (yield* fleet.reconcile()).value;
			expect(blocked.stage).toBe("executing");
			expect(blocked.blocker).toContain("Fresh available provider quota");
			expect(blocked.attempts).toHaveLength(1);
			expect(blocked.attempts[0]?.publishedRecovery).toBeUndefined();
			expect(blocked.attempts[0]?.status).toBe("submitting");
			expect(observed.launched).toHaveLength(1);
			yield* fleet.restart();
			quota(100);
			const recovered = (yield* fleet.reconcile()).value;
			expect(recovered.stage).toBe("executing");
			expect(recovered.prompt).toBe(initial.prompt);
			expect(recovered.attempts.at(-1)?.prompt?.split(initial.prompt)).toHaveLength(2);
			expect(recovered.attempts.at(-1)?.role).toBe(published === "none" ? "worker" : "repair");
			expect(recovered.attempts.at(-1)?.prompt).toContain("Accepted Codex turn is not observable");
			if (published === "pr") {
				expect(recovered.attempts.at(-1)?.prompt).toContain(WORK_PR);
			}
			expect(observed.launched).toHaveLength(2);
			expect(observed.decisions).toEqual([]);
		},
	);
}
