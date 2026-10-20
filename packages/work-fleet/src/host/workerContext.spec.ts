import { expect } from "@effect/vitest";
import { boardWork, host, localOnlyBoard } from "#test/hostStory.ts";
import { cloudWorker, goal, navigationTask, planningGoal, REPOSITORY_PURPOSE, repositoryReadme } from "#test/workerBrief.ts";

const context = [
	localOnlyBoard,
	boardWork({ "goal.md": goal, "planning.md": planningGoal, "task.md": navigationTask }, cloudWorker),
	repositoryReadme,
];

host.it("workers receive repository purpose and the titles and bodies of implemented goals", context, function* (daemon) {
	yield* daemon.approve("task.navigation");
	const prompt = daemon.providerStarts()[0]?.prompt ?? "";
	expect(prompt.startsWith(REPOSITORY_PURPOSE)).toBe(true);
	expect(prompt).not.toContain("Private setup details.");
	expect(prompt).toContain(goal.slice(goal.indexOf("# People")).trim());
	expect(prompt).toContain(planningGoal.slice(planningGoal.indexOf("# Daily")).trim());
	expect(prompt.indexOf("# People can navigate")).toBeLessThan(prompt.indexOf("# Sidebar follows"));
	const original = yield* daemon.get("task.navigation");
	expect(original.boardContext).toBe(navigationTask);
	daemon.writeBoard("goal.md", goal.replace("People need to find", "Everyone needs to find"));
	yield* daemon.admit();
	expect((yield* daemon.get("task.navigation")).boardRevision).toBe(original.boardRevision);
});

host.it("tasks reach workers as readable content without Board bookkeeping", context, function* (daemon) {
	yield* daemon.approve("task.navigation");
	const prompt = daemon.providerStarts()[0]?.prompt ?? "";
	expect(prompt).toContain("# Sidebar follows the project hierarchy\n\nReplace the flat document list");
	expect(prompt).toContain("Areas:\n\n- navigation\n\n- documents");
	expect(prompt).toContain("Acceptance criteria:\n\n- The sidebar groups tasks");
	for (const field of ["id:", "kind:", "status:", "owner:", "fleet:", "fleet-priority:", "next_action:", "relationships:", "target:"]) {
		expect(prompt).not.toContain(field);
	}
	expect(prompt).not.toContain("goal.navigation");
	expect(prompt).not.toContain("Work Board task:");
});

host.it("the shorter protocol retains Fleet's question and final report markers", context, function* (daemon) {
	yield* daemon.approve("task.navigation");
	const prompt = daemon.providerStarts()[0]?.prompt ?? "";
	expect(prompt).toContain("FLEET_QUESTION: <question>");
	expect(prompt).toContain("FLEET_MAINTAINER_QUESTION: <question>");
	expect(prompt).toContain("FLEET_HEAD: <sha>\nFLEET_PR: <url or none>");
	const boundary = prompt.indexOf("\n\nCloud startup:");
	expect(boundary).toBeGreaterThan(prompt.length / 2);
	expect(prompt.length).toBeLessThan(6000);
});

host.it("an edited task retains goal context and protocol without returning to raw frontmatter", context, function* (daemon) {
	yield* daemon.approve("task.navigation");
	const edited = navigationTask.replaceAll("flat document list", "alphabetical document list");
	daemon.writeBoard("task.md", edited);
	yield* daemon.schedulerPass();
	const current = yield* daemon.get("task.navigation");
	expect(current.prompt).toContain("Replace the alphabetical document list");
	expect(current.prompt).not.toContain("Replace the flat document list");
	expect(current.prompt).toContain("# People can navigate a growing project");
	expect(current.prompt).toContain("FLEET_HEAD: <sha>\nFLEET_PR: <url or none>");
	expect(current.prompt).not.toContain("fleet: approved");
	const steer = daemon.providerSteers().at(-1)?.prompt;
	expect(steer).toContain("Full new brief:\n\nProduct goals:\n\n# People can navigate a growing project");
	expect(steer).toContain("Approved task:\n\n# Sidebar follows the project hierarchy");
	expect(steer).not.toContain("fleet: approved");
	expect(current.boardContext).toBe(edited);
});

for (const change of ["replace", "remove"] as const) {
	host.it(`${change} an implemented goal refreshes both the saved prompt and the worker's context`, context, function* (daemon) {
		yield* daemon.approve("task.navigation");
		const edited =
			change === "replace"
				? navigationTask.replace("target: goal.navigation", "target: goal.planning")
				: navigationTask.replace("relationships:\n  - kind: implements\n    target: goal.navigation\n", "");
		daemon.writeBoard("task.md", edited);
		yield* daemon.schedulerPass();
		const current = yield* daemon.get("task.navigation");
		const steer = daemon.providerSteers().at(-1)?.prompt ?? "";
		for (const prompt of [current.prompt, steer]) {
			expect(prompt).toContain("Approved task:\n\n# Sidebar follows the project hierarchy");
			expect(prompt).not.toContain("# People can navigate a growing project");
			if (change === "replace") {
				expect(prompt).toContain(planningGoal.slice(planningGoal.indexOf("# Daily")).trim());
			} else {
				expect(prompt).not.toContain("Product goals:");
			}
			expect(prompt).not.toContain("fleet: approved");
		}
	});
}
