import { expect } from "@effect/vitest";
import { lostAcknowledgement, publishedWork, unreadablePublication, workerTurnsCanBeLost } from "#test/engineLostTurnTraits.ts";
import { engine } from "#test/engineStory.ts";
import { publicationRecoveryStory } from "#test/recoveryStories.ts";
import { WORK_BRANCH, WORK_PR } from "#test/workPublication.ts";

for (const published of ["branch", "pr"] as const) {
	engine.it(
		`a visible ${published} permits repair when the other publication read fails`,
		[workerTurnsCanBeLost(), lostAcknowledgement(), publishedWork(published), unreadablePublication(published === "branch" ? "pr" : "branch")],
		function* ({ fleet, prepareWork, loseTurn, launches, publishedDecisions }) {
			yield* prepareWork("one");
			const initial = (yield* fleet.dispatch("one")).value;
			loseTurn(initial.attempts.at(-1)?.sessionId);
			const repaired = (yield* fleet.reconcile("one")).value;
			expect(repaired.step).toBe("working");
			expect(repaired.attempts.at(-1)?.role).toBe("repair");
			expect(repaired.attempts.at(-1)?.prompt).toContain(WORK_BRANCH);
			expect(publishedDecisions()).toHaveLength(0);
			expect(launches()).toEqual(["operation-1", "operation-2"]);
		},
	);
}

for (const acknowledgementLost of [false, true]) {
	for (const published of ["none", "branch", "pr"] as const) {
		engine.it(
			`lost accepted turn ${acknowledgementLost ? "without" : "with"} a receipt recovers from ${published} after restart`,
			[workerTurnsCanBeLost(), publishedWork(published), ...(acknowledgementLost ? [lostAcknowledgement()] : [])],
			function* ({ fleet, prepareWork, restart, loseTurn, advanceTime, launches, providerCalls, publishedDecisions }) {
				yield* prepareWork("one");
				const initial = (yield* fleet.dispatch("one")).value;
				loseTurn(initial.attempts.at(-1)?.sessionId);
				yield* fleet.reconcile("one");
				advanceTime(300_000);
				yield* restart();
				const recovered = (yield* fleet.reconcile("one")).value;
				expect(recovered.step).toBe("working");
				expect(recovered.decision).toBeUndefined();
				expect(publishedDecisions()).toHaveLength(0);
				expect(launches()).toEqual(["operation-1", "operation-2"]);
				expect(
					providerCalls()
						.filter((call) => call.call === "turn")
						.map((call) => call.operationId),
				).toEqual(["operation-1", "operation-2"]);
				expect(recovered.attempts[0]).toMatchObject({ sessionUnusable: true, status: "failed" });
				expect(recovered.attempts[0]?.output).toContain("Accepted Codex turn is not observable");
				expect(recovered.attempts.at(-1)?.role).toBe(published === "none" ? "worker" : "repair");
				if (published === "none") {
					expect(recovered.releaseReason).toBeUndefined();
					expect(recovered.attempts[0]?.output).toContain("release and relaunch");
				} else {
					expect(recovered.attempts.at(-1)?.prompt).toContain(`existing branch ${WORK_BRANCH}`);
				}
				if (published === "pr") {
					expect(recovered.attempts.at(-1)?.prompt).toContain(WORK_PR);
				}
				yield* restart();
				expect((yield* fleet.reconcile("one")).value.attempts.map((entry) => entry.operationId)).toEqual(["operation-1", "operation-2"]);
			},
		);
	}
}

engine.it(
	publicationRecoveryStory.name,
	[workerTurnsCanBeLost(), lostAcknowledgement(), unreadablePublication("branch")],
	function* ({ fleet, prepareWork, restart, loseTurn, publishBranch, publishPullRequest, respond, launches, publishedDecisions }) {
		yield* prepareWork("one");
		const initial = (yield* fleet.dispatch("one")).value;
		loseTurn(initial.attempts.at(-1)?.sessionId);
		const waiting = (yield* fleet.reconcile("one")).value;
		expect(waiting.step).toBe("waiting");
		expect(waiting.decision?.code).toBe("session-turn-missing");
		expect(waiting.decision?.reason).toContain("observable");
		expect(launches()).toEqual(["operation-1"]);
		const id = waiting.decision?.id;
		if (id === undefined) {
			throw new Error("Fleet did not publish a lost-turn decision");
		}
		respond(id, "retry");
		yield* restart();
		const unreadable = (yield* fleet.reconcile("one")).value;
		expect(unreadable.step).toBe("waiting");
		expect(unreadable.decision?.id).toBe(id);
		expect(publishedDecisions()).toEqual([waiting.decision?.reason]);
		expect(launches()).toEqual(["operation-1"]);
		publishBranch();
		publishPullRequest();
		yield* restart();
		const repaired = (yield* fleet.reconcile("one")).value;
		expect(repaired.step).toBe("working");
		expect(repaired.decision).toBeUndefined();
		expect(repaired.attempts.at(-1)).toMatchObject({ role: "repair", status: "running" });
		expect(repaired.attempts.at(-1)?.sessionId).not.toBe(initial.attempts.at(-1)?.sessionId);
		expect(repaired.attempts.at(-1)?.prompt).toContain("Human context");
		expect(repaired.attempts.at(-1)?.prompt).toContain(WORK_PR);
		expect(repaired.responses).toMatchObject([{ action: "retry", boardAcknowledged: true }]);
		expect(launches()).toEqual(["operation-1", "operation-2"]);
	},
);

engine.it(
	"a release answer retires lost work without another submission",
	[workerTurnsCanBeLost(), lostAcknowledgement(), unreadablePublication("branch")],
	function* ({ fleet, prepareWork, restart, loseTurn, respond, launches }) {
		yield* prepareWork("one");
		loseTurn((yield* fleet.dispatch("one")).value.attempts.at(-1)?.sessionId);
		const waiting = (yield* fleet.reconcile("one")).value;
		expect(waiting.decision?.code).toBe("session-turn-missing");
		if (waiting.decision === undefined) {
			throw new Error("Fleet did not publish a lost-turn decision");
		}
		respond(waiting.decision.id, "release");
		yield* restart();
		const released = (yield* fleet.reconcile("one")).value;
		expect(released.step).toBe("released");
		expect(released.responses).toMatchObject([{ action: "release", boardAcknowledged: true }]);
		expect(launches()).toEqual(["operation-1"]);
	},
);
