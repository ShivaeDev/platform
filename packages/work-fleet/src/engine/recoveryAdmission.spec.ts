import { expect } from "@effect/vitest";
import { lostAcknowledgement, publishedWork, workerTurnsCanBeLost } from "#test/engineLostTurnTraits.ts";
import { engine } from "#test/engineStory.ts";
import { WORK_PR } from "#test/workPublication.ts";

for (const published of ["none", "pr"] as const) {
	engine.it(
		`a lost ${published} turn keeps its intent until quota admits its replacement after restart`,
		[workerTurnsCanBeLost(), lostAcknowledgement(), publishedWork(published)],
		function* ({ fleet, prepareWork, restart, loseTurn, setProviderQuota, launches, publishedDecisions }) {
			yield* prepareWork("one");
			const initial = (yield* fleet.dispatch("one")).value;
			loseTurn(initial.attempts.at(-1)?.sessionId);
			setProviderQuota(1);
			const blocked = (yield* fleet.reconcile("one")).value;
			expect(blocked.step).toBe("working");
			expect(blocked.blocker).toContain("Fresh available provider quota");
			expect(blocked.attempts.map(({ operationId, publishedRecovery, status }) => ({ operationId, publishedRecovery, status }))).toEqual([
				{ operationId: "operation-1", publishedRecovery: undefined, status: "submitting" },
			]);
			expect(launches()).toEqual(["operation-1"]);
			yield* restart();
			setProviderQuota(100);
			const recovered = (yield* fleet.reconcile("one")).value;
			expect(recovered.step).toBe("working");
			expect(recovered.prompt).toBe(initial.prompt);
			expect(recovered.attempts.at(-1)?.prompt?.match(new RegExp(RegExp.escape(initial.prompt), "gu"))).toEqual([initial.prompt]);
			expect(recovered.attempts.at(-1)?.role).toBe(published === "none" ? "worker" : "repair");
			expect(recovered.attempts.at(-1)?.prompt).toContain("Accepted Codex turn is not observable");
			if (published === "pr") {
				expect(recovered.attempts.at(-1)?.prompt).toContain(WORK_PR);
			}
			expect(launches()).toEqual(["operation-1", "operation-2"]);
			expect(publishedDecisions()).toEqual([]);
		},
	);
}
