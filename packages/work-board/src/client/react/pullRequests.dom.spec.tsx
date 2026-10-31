import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { pullRequestWorkspace } from "#test/pullRequestWorkspace.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen } from "#test/screenTraits.ts";
import { sessionScreen } from "#test/sessionScreen.ts";

expectNoReactWarnings();

screenStory.it(
	"Pull requests groups Fleet's pull requests with the ones ready to merge first",
	[pullRequestWorkspace(), openScreen()],
	function* ({ pullRequestGroups }) {
		expect(yield* pullRequestGroups()).toEqual([
			"Ready to merge: task.ready, task.sweep",
			"Reviewing: task.checks, task.review",
			"Working: task.repair",
			"Waiting on you: task.question",
			"Waiting on orchestrator: task.orchestrator",
		]);
	},
);

screenStory.it(
	"A pull request row links the pull request, its task and its review and says how long it has been in its state",
	[pullRequestWorkspace(), openScreen()],
	function* ({ pullRequestRow }) {
		expect(yield* pullRequestRow("task.ready")).toEqual({
			links: expect.arrayContaining([
				"#12 → https://github.com/example/project/pull/12",
				"Deliver ready → /tasks/ready.md",
				"Review document → /responses/review.ready.md",
			]),
			text: expect.stringMatching(/task\.ready.*Verdict: request changes.*New users need a next action\./su),
			time: "5m in this state",
		});
	},
);

screenStory.it(
	"The sidebar's Pull requests link counts what is ready to merge and opens the page from anywhere",
	[pullRequestWorkspace(), openScreen()],
	function* ({ mainHeading, navigate, openPullRequests, pullRequestsLink }) {
		yield* navigate("/tasks/ready.md");
		yield* outcomes([
			["heading", () => mainHeading(), "Deliver ready"],
			["link", () => pullRequestsLink(), { badge: { label: "2 ready to merge", shown: "2" }, href: "/_board/pull-requests" }],
		]);

		yield* openPullRequests();

		expect(yield* mainHeading()).toBe("Pull requests");
	},
);

screenStory.it(
	"A merged pull request leaves the list and the sidebar count through the live Board subscription",
	[pullRequestWorkspace(true), sessionScreen("response")],
	function* ({ liveSessionSettles, pullRequestGroups, pullRequestMerged, pullRequestsLink }) {
		yield* liveSessionSettles();
		yield* outcomes([
			["groups", () => pullRequestGroups(), expect.arrayContaining(["Ready to merge: task.ready, task.sweep"])],
			["link", () => pullRequestsLink(), expect.objectContaining({ badge: expect.objectContaining({ shown: "2" }) })],
		]);

		yield* pullRequestMerged("task.ready", "tasks/ready.md", "---\nid: task.ready\nkind: task\nstatus: done\n---\n# Deliver ready\n\nMerged.\n");

		yield* outcomes([
			["groups", () => pullRequestGroups(), expect.arrayContaining(["Ready to merge: task.sweep"])],
			["link", () => pullRequestsLink(), expect.objectContaining({ badge: expect.objectContaining({ shown: "1" }) })],
		]);
	},
);
