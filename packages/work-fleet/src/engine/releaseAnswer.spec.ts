import { expect } from "@effect/vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork, noChangeReported } from "#test/engineTraits.ts";
import { mainMovedPastPreparation } from "#test/mainMovedPastPreparation.ts";
import { prepared } from "#test/preparation.ts";

for (const explicit of [false, true]) {
	isolatedEngine.it(
		`${explicit ? "explicit release" : "a release answer"} hands back incomplete context and permits fresh preparation on current main`,
		[markdownWork(), mainMovedPastPreparation("scoped context"), noChangeReported()],
		function* (fleet) {
			fleet.writeBoardWork(
				"dependent.md",
				"---\nid: dependent\nkind: task\nfleet: approved\nrelationships: [{ kind: depends_on, target: one }]\n---\n# Dependent\n",
			);
			yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ contextComplete: false }), prompt: "Implement one", workId: "one" });
			const stopped = (yield* fleet.dispatch("one")).value;
			expect(stopped).toMatchObject({ decision: { code: "incomplete-context" }, step: "waiting" });
			yield* fleet.prepareWork("dependent");
			yield* fleet.schedule();
			expect((yield* fleet.get("dependent")).value.blocker).toContain("one");

			yield* fleet.answerFromHost("one", explicit ? "Release Fleet ownership." : "release\n", explicit);
			const released = (yield* fleet.get("one")).value;
			expect(released.step).toBe("released");
			expect(released.decision).toBeUndefined();
			expect(released.responses).toMatchObject([{ action: "release" }]);
			yield* fleet.schedule();
			expect((yield* fleet.get("dependent")).value.blocker).toContain("released without a merged delivery");

			yield* fleet.prepare({
				cwd: "/synthetic",
				preparation: prepared({ baseRevision: "current-main" }),
				prompt: "Implement one on current main",
				workId: "one",
			});
			const dispatched = (yield* fleet.dispatch("one")).value;
			expect(dispatched).toMatchObject({ preparation: { baseRevision: "current-main" }, step: "working" });
			expect(fleet.providerStarts().map(({ prompt }) => prompt)).toEqual(["Implement one on current main"]);
			fleet.finishWorkers();
			expect((yield* fleet.reconcile("one")).value.step).toBe("done");
			yield* fleet.schedule();
			expect((yield* fleet.get("dependent")).value.step).toBe("working");
		},
	);
}

isolatedEngine.it(
	"a rejected host answer logs the work and cause and displays that cause in status",
	[markdownWork(), mainMovedPastPreparation("scoped context")],
	function* (fleet) {
		yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ contextComplete: false }), prompt: "Implement one", workId: "one" });
		yield* fleet.dispatch("one");
		const failed = yield* fleet.answerFromHost("one", "retry");
		expect(failed?.blocker).toBe("Answer failed: This decision only permits release; choose release to stop and hand back");
		const logs = fleet.recordedSchedulerLogs();
		expect(logs).toMatchObject([{ level: "Error", message: ["Failed to apply answer for one"] }]);
		expect(logs[0]?.cause).toContain("This decision only permits release");
	},
);

isolatedEngine.it(
	"an answer rejected during reconciliation logs its cause and displays the failure",
	[markdownWork(), mainMovedPastPreparation("scoped context")],
	function* (fleet) {
		yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ contextComplete: false }), prompt: "Implement one", workId: "one" });
		const stopped = (yield* fleet.dispatch("one")).value;
		const decision = stopped.decision;
		if (decision?.published === undefined) {
			throw new Error("Missing preparation decision");
		}
		fleet.answerReportDecision(decision.published, "retry");
		const failed = (yield* fleet.reconcileLogged("one")).value;
		expect(failed.blocker).toBe("Answer failed: This decision only permits release; choose release to stop and hand back");
		expect(yield* fleet.status()).toContain(failed.blocker);
		const logs = fleet.recordedSchedulerLogs();
		expect(logs.map(({ message }) => message)).toEqual([
			[
				"Failed to apply answer for one",
				expect.objectContaining({ message: "This decision only permits release; choose release to stop and hand back" }),
			],
		]);
	},
);
