import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { pullRequestWorkspace } from "#test/pullRequestWorkspace.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { sessionScreen } from "#test/sessionScreen.ts";

expectNoReactWarnings();

screenStory.it(
	"opens Fleet's pull requests from navigation, ready first, with task links and time in state",
	[pullRequestWorkspace(), openScreen()],
	function* ({ findElement, findElements, readText, navigate, click }) {
		yield* eventually(() => expect(readText("#doc h1")).toBe("Pull requests"));
		expect(findElements("#doc section").map((section) => section.getAttribute("aria-label"))).toEqual([
			"Ready to merge",
			"Reviewing",
			"Working",
			"Waiting on you",
			"Waiting on orchestrator",
		]);
		const groups = findElements("#doc section").map((section) =>
			[...section.querySelectorAll("[data-pr-work]")].map((entry) => entry.getAttribute("data-pr-work")),
		);
		expect(groups).toEqual([["task.ready", "task.sweep"], ["task.checks", "task.review"], ["task.repair"], ["task.question"], ["task.orchestrator"]]);
		const row = findElement('[data-pr-work="task.ready"]');
		expect(row?.querySelector('a[href="https://github.com/example/project/pull/12"]')?.textContent).toBe("#12");
		expect(row?.querySelector('a[href="/tasks/ready.md"]')?.textContent).toBe("Deliver ready");
		expect(row?.textContent).toContain("task.ready");
		expect(row?.querySelector('a[href="/responses/review.ready.md"]')?.textContent).toBe("Review document");
		expect(row?.textContent).toContain("Verdict: request changes");
		expect(row?.textContent).toContain("New users need a next action.");
		expect(row?.querySelector("time")?.textContent).toBe("5m in this state");
		expect(findElement("#pull-requests-open [role='status']")?.getAttribute("aria-label")).toBe("2 ready to merge");
		yield* Effect.promise(() => navigate("/tasks/ready.md"));
		expect(findElement("#pull-requests-open")?.getAttribute("href")).toBe("/_board/pull-requests");
		expect(readText("#pull-requests-open")).toContain("2");
		click("#pull-requests-open");
		yield* eventually(() => expect(readText("#doc h1")).toBe("Pull requests"));
	},
);

screenStory.it(
	"removes a merged PR and reduces the navigation count through the live Board subscription",
	[pullRequestWorkspace(true), sessionScreen("response")],
	function* ({ findElement, readText, mergeSessionPullRequest, editSessionFile }) {
		yield* eventually(() => expect(readText("#pull-requests-open [role='status']")).toBe("2"));
		const retained = findElement('[data-pr-work="task.sweep"]');
		expect(findElement('[data-pr-work="task.ready"]')).not.toBeNull();
		mergeSessionPullRequest("task.ready");
		editSessionFile("tasks/ready.md", "---\nid: task.ready\nkind: task\nstatus: done\n---\n# Deliver ready\n\nMerged.\n");
		yield* eventually(() => expect(findElement('[data-pr-work="task.ready"]')).toBeNull());
		expect(readText("#pull-requests-open [role='status']")).toBe("1");
		expect(findElement('[data-pr-work="task.sweep"]')).toBe(retained);
		expect(readText("#doc h1")).toBe("Pull requests");
	},
);
