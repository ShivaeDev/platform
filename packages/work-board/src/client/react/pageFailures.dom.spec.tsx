import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { unavailableWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen, routedScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";
import { sessionDiagnostics } from "#test/sessionTransport.ts";
import { notFoundNotice } from "#test/shellExpectations.ts";
import { sessionOpenedAt } from "#test/shellTraits.tsx";

expectNoReactWarnings();

const files = { "home.md": "# Home", "notes/plan.md": "# Plan" };
const NOT_ANSWERING = "The Board server isn't answering";

for (const { crumb, heading, link } of [
	{ crumb: "Workspace/ Library", heading: "Library", link: "/_board/library" },
	{ crumb: "Workspace/ notes/ plan.md", heading: "Plan", link: "/notes/plan.md" },
]) {
	screenStory.it(
		`says the Board server isn't answering at ${link}, offers Retry and keeps the breadcrumb`,
		sessionOpenedAt(files, "/_board/goals"),
		function* ({ boardServerStops, breadcrumb, followWhileServerDown, pageNotice }) {
			yield* boardServerStops();
			expect(yield* breadcrumb()).toBe("Workspace/ Goals");

			yield* followWhileServerDown(link);

			yield* outcomes([
				["the breadcrumb", () => breadcrumb(), crumb],
				[
					"the notice",
					() => pageNotice(),
					expect.objectContaining({
						description: expect.stringContaining("This page tries again on its own. RpcClientError:"),
						retry: "offered",
						title: NOT_ANSWERING,
					}),
				],
			]);
		},
	);

	screenStory.it(
		`opens ${link} on its own once the Board server answers again`,
		sessionOpenedAt(files, "/_board/goals"),
		function* ({ boardServerAnswers, boardServerStops, followWhileServerDown, mainHeading, pageNotice }) {
			yield* boardServerStops();
			yield* followWhileServerDown(link);
			expect(yield* pageNotice()).toEqual(expect.objectContaining({ title: NOT_ANSWERING }));

			yield* boardServerAnswers();

			expect(yield* mainHeading()).toBe(heading);
		},
	);
}

screenStory.it(
	"opens a page while the Board server reads the Fleet daemon at the same moment",
	[sessionDiagnostics(() => null), ...sessionOpenedAt(files, "/notes/plan.md")],
	function* ({ mainHeading, pageReadBesideDaemon }) {
		yield* outcomes([
			["the heading", () => mainHeading(), "Plan"],
			["the page read beside the daemon", () => pageReadBesideDaemon(), "read"],
		]);
	},
);

for (const { link, name } of [
	{ link: "/_board/system", name: "System" },
	{ link: "/_board/start", name: "Getting started" },
	{ link: "/_board/handoff?item=task.plan", name: "Hand off to an agent" },
]) {
	screenStory.it(
		`names ${name} in the breadcrumb and browser title when its data can't load`,
		sessionOpenedAt(files, "/notes/plan.md"),
		function* ({ boardServerStops, breadcrumb, browserTitle, followWhileServerDown, pageNotice }) {
			yield* boardServerStops();
			expect(yield* breadcrumb()).toBe("Workspace/ Plan");

			yield* followWhileServerDown(link);

			yield* outcomes([
				["the breadcrumb", () => breadcrumb(), `Workspace/ ${name}`],
				["the browser title", () => browserTitle(), `${name} · Work Board`],
				["the notice", () => pageNotice(), expect.objectContaining({ title: NOT_ANSWERING })],
			]);
		},
	);
}

screenStory.it(
	"names Goals in the breadcrumb and browser title when the workspace can't be read",
	[screenFiles(files), screenRoute("/_board/goals"), unavailableWorkspace(), openScreen()],
	function* ({ breadcrumb, browserTitle, pageNotice }) {
		yield* outcomes([
			["the breadcrumb", () => breadcrumb(), "Workspace/ Goals"],
			["the browser title", () => browserTitle(), "Goals · Work Board"],
			["the notice", () => pageNotice(), expect.objectContaining({ title: "This page couldn't be opened" })],
		]);
	},
);

screenStory.it(
	"offers Retry and System when a document can't be read",
	[routedScreen(files, "/_board/goals")],
	function* ({ failDocument, follow, mainHeading, pageNotice }) {
		yield* failDocument();
		expect(yield* mainHeading()).toBe("Goals");

		yield* follow("/notes/plan.md");

		expect(yield* pageNotice()).toEqual({
			description: "InternalServerError: Internal server error",
			links: [["Open System", "/_board/system"]],
			retry: "offered",
			title: "This page couldn't be opened",
		});
	},
);

screenStory.it(
	"opens the document once Retry runs after reads recover",
	[routedScreen(files, "/_board/goals")],
	function* ({ failDocument, follow, mainHeading, pageNotice, recoverDocument, retryPage }) {
		yield* failDocument();
		yield* follow("/notes/plan.md");
		yield* recoverDocument();
		expect(yield* pageNotice()).toEqual(expect.objectContaining({ title: "This page couldn't be opened" }));

		yield* retryPage();

		expect(yield* mainHeading()).toBe("Plan");
	},
);

for (const url of ["/_board/goals/zzz", "/_board/zzz", "/notes"]) {
	screenStory.it(
		`shows the not-found page instead of another page at ${url}`,
		[routedScreen(files, url)],
		function* ({ breadcrumb, mainHeading, pageAnswer, pageNotice }) {
			yield* outcomes([
				["the answer", () => pageAnswer(), "Not found"],
				["the breadcrumb", () => breadcrumb(), "Workspace/ Page not found"],
				["the heading", () => mainHeading(), "no heading"],
				["the notice", () => pageNotice(), notFoundNotice(url)],
			]);
		},
	);
}

for (const url of ["/notes/broken%E0.md", "/_board/item/broken%E0"]) {
	screenStory.it(
		`shows the not-found page for the undecodable link ${url}`,
		[routedScreen(files, url)],
		function* ({ breadcrumb, browserTitle, pageAnswer, pageNotice }) {
			yield* outcomes([
				["the answer", () => pageAnswer(), "Not found"],
				["the breadcrumb", () => breadcrumb(), "Workspace/ Page not found"],
				["the browser title", () => browserTitle(), "Page not found · Work Board"],
				["the notice", () => pageNotice(), notFoundNotice(url)],
			]);
		},
	);
}

screenStory.it(
	"keeps the live status Live on a not-found page",
	sessionOpenedAt(files, "/_board/goals/zzz"),
	function* ({ liveIndicator, pageNotice }) {
		yield* outcomes([
			["the live status", () => liveIndicator(), expect.objectContaining({ announced: "Live" })],
			["the notice", () => pageNotice(), expect.objectContaining({ title: "Page not found" })],
		]);
	},
);

screenStory.it(
	"says why a handoff can't be prepared without the error's type name",
	[routedScreen(files, "/_board/handoff?item=task.missing")],
	function* ({ pageAlert }) {
		expect(yield* pageAlert()).toBe("The item is missing, ambiguous or unavailable. Earlier handoffs are still listed below.");
	},
);

screenStory.it(
	"tells the reader to give items their own IDs when an item link matches two files",
	[
		routedScreen(
			{ ...files, "one.md": "---\nid: task.twice\nkind: task\n---\n# One\n", "two.md": "---\nid: task.twice\nkind: task\n---\n# Two\n" },
			"/_board/item/task.twice/",
		),
	],
	function* ({ breadcrumb, pageNotice }) {
		yield* outcomes([
			["the breadcrumb", () => breadcrumb(), "Workspace/ task.twice"],
			[
				"the notice",
				() => pageNotice(),
				expect.objectContaining({
					description: "Give each item its own ID in its file, then open the link again.",
					title: "Two items share this ID",
				}),
			],
		]);
	},
);
