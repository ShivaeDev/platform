import { expect } from "@effect/vitest";
import { task } from "#test/fleetHost.ts";
import { noChangeHost } from "#test/hostScenarioTraits.ts";
import { boardWork, host } from "#test/hostStory.ts";

for (const role of ["worker", "reviewer"] as const) {
	host.it(
		`reloads edited ${role} guidance between launches in the same host`,
		[
			boardWork(
				{ "guidance.txt": "Original synthetic guidance.", "one.md": task("one", "approved"), "two.md": task("two", "approved") },
				{ worker: { branchPrefix: "test/", sharedEnvironment: "/synthetic/env.sh", [`${role}Guidance`]: { file: "guidance.txt" } } },
			),
			noChangeHost,
		],
		function* (daemon) {
			let first = (yield* daemon.approve("one")).value;
			if (role === "reviewer") {
				daemon.finishTurn(first);
				first = yield* daemon.reconcile("one");
			}
			expect(first.attempts.find((attempt) => attempt.role === role)?.prompt).toContain("Original synthetic guidance.");
			daemon.writeBoard("guidance.txt", "Updated synthetic guidance.");
			yield* daemon.touchGuidance();
			let second = (yield* daemon.approve("two")).value;
			if (role === "reviewer") {
				daemon.finishTurn(second);
				second = yield* daemon.reconcile("two");
			}
			const prompt = second.attempts.find((attempt) => attempt.role === role)?.prompt;
			expect(prompt).toContain("Updated synthetic guidance.");
			expect(prompt).not.toContain("Original synthetic guidance.");
		},
	);
}
