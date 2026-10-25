import { Effect } from "effect";
import { expect } from "vitest";
import { eventually, expectNoReactWarnings } from "@shivaedev/effect-react/client/testing.ts";
import { unavailableWorkspace } from "#test/screenEnvironment.ts";
import { screenStory } from "#test/screenStory.ts";
import { openScreen, routedScreen } from "#test/screenTraits.ts";
import { screenFiles, screenRoute } from "#test/screenWorkspaceTraits.ts";
import { sessionScreen } from "#test/sessionScreen.ts";
import { sessionDiagnostics } from "#test/sessionTransport.ts";

expectNoReactWarnings();

const files = { "home.md": "# Home", "notes/plan.md": "# Plan" };

for (const { crumb, heading, link } of [
	{ crumb: "Workspace/ Library", heading: "Library", link: "/_board/library" },
	{ crumb: "Workspace/ notes/ plan.md", heading: "Plan", link: "/notes/plan.md" },
]) {
	screenStory.it(
		`says the Board server isn't answering at ${link}, keeps the breadcrumb and retries on request`,
		[screenFiles(files, { home: "home.md" }), screenRoute("/_board/goals"), sessionScreen("response")],
		function* ({ click, findElements, follow, readText, setSessionServer }) {
			yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Goals")));
			setSessionServer(false);
			yield* Effect.promise(() => follow(link));
			yield* Effect.promise(() => eventually(() => expect(readText("#doc [data-slot=empty-title]")).toBe("The Board server isn't answering")));
			expect(readText("#doc [data-slot=empty-description]")).toContain("This page tries again on its own. RpcClientError:");
			yield* Effect.promise(() => eventually(() => expect(readText("#breadcrumbs")).toBe(crumb)));
			setSessionServer(true);
			click(findElements("#doc button").find((button) => button.textContent === "Retry"));
			yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe(heading)));
		},
	);
}

screenStory.it(
	"reaches the Board while the Board server reads the Fleet daemon at the same moment",
	[sessionDiagnostics(() => null), screenFiles(files, { home: "home.md" }), screenRoute("/notes/plan.md"), sessionScreen("response")],
	function* ({ readPageBesideDaemon, readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Plan")));
		expect(yield* Effect.promise(readPageBesideDaemon)).toBe("read");
	},
);

for (const { link, name } of [
	{ link: "/_board/system", name: "System" },
	{ link: "/_board/start", name: "Getting started" },
	{ link: "/_board/handoff?item=task.plan", name: "Hand off to an agent" },
]) {
	screenStory.it(
		`names ${name} in the breadcrumb and browser title when its data can't load`,
		[screenFiles(files, { home: "home.md" }), screenRoute("/notes/plan.md"), sessionScreen("response")],
		function* ({ follow, readText, readTitle, setSessionServer }) {
			yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Plan")));
			setSessionServer(false);
			yield* Effect.promise(() => follow(link));
			yield* Effect.promise(() => eventually(() => expect(readText("#doc [data-slot=empty-title]")).toBe("The Board server isn't answering")));
			yield* Effect.promise(() => eventually(() => expect(readText("#breadcrumbs")).toBe(`Workspace/ ${name}`)));
			expect(readTitle()).toBe(`${name} · Work Board`);
		},
	);
}

screenStory.it(
	"names Goals in the breadcrumb and browser title when its data can't load",
	[screenFiles(files), screenRoute("/_board/goals"), unavailableWorkspace(), openScreen()],
	function* ({ readText, readTitle }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc [data-slot=empty-title]")).toBe("This page couldn't be opened")));
		yield* Effect.promise(() => eventually(() => expect(readText("#breadcrumbs")).toBe("Workspace/ Goals")));
		expect(readTitle()).toBe("Goals · Work Board");
	},
);

screenStory.it(
	"offers Retry and System when a document can't be read",
	[routedScreen(files, "/_board/goals")],
	function* ({ click, failDocument, findElements, follow, readText, recoverDocument }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Goals")));
		failDocument();
		yield* Effect.promise(() => follow("/notes/plan.md"));
		yield* Effect.promise(() => eventually(() => expect(readText("#doc [data-slot=empty-title]")).toBe("This page couldn't be opened")));
		expect(readText("#doc [data-slot=empty-description]")).toBe("InternalServerError: Internal server error");
		expect(findElements("#doc [data-slot=empty] a").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
			["Open System", "/_board/system"],
		]);
		recoverDocument();
		click(findElements("#doc button").find((button) => button.textContent === "Retry"));
		yield* Effect.promise(() => eventually(() => expect(readText("#doc h1")).toBe("Plan")));
	},
);

for (const url of ["/_board/goals/zzz", "/_board/zzz", "/notes"]) {
	screenStory.it(
		`shows the not-found page instead of another page at ${url}`,
		[routedScreen(files, url)],
		function* ({ findElements, readText, readAttribute }) {
			yield* Effect.promise(() => eventually(() => expect(readText("#doc [data-slot=empty-title]")).toBe("Page not found")));
			expect(readText("#doc [data-slot=empty-description]")).toBe(`Nothing on the Board lives at ${url}. The link may be old or mistyped.`);
			expect(readText("#doc h1")).toBeUndefined();
			expect(readAttribute("#doc", "data-status")).toBe("404");
			yield* Effect.promise(() => eventually(() => expect(readText("#breadcrumbs")).toBe("Workspace/ Page not found")));
			expect(findElements("#doc [data-slot=empty] a").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
				["Back to Today", "/"],
				["Browse the Library", "/_board/library"],
			]);
		},
	);
}

for (const url of ["/notes/broken%E0.md", "/_board/item/broken%E0"]) {
	screenStory.it(
		`shows the not-found page for the undecodable link ${url}`,
		[routedScreen(files, url)],
		function* ({ readAttribute, readText, readTitle }) {
			yield* Effect.promise(() => eventually(() => expect(readText("#doc [data-slot=empty-title]")).toBe("Page not found")));
			expect(readText("#doc [data-slot=empty-description]")).toBe(`Nothing on the Board lives at ${url}. The link may be old or mistyped.`);
			expect(readAttribute("#doc", "data-status")).toBe("404");
			yield* Effect.promise(() => eventually(() => expect(readText("#breadcrumbs")).toBe("Workspace/ Page not found")));
			expect(readTitle()).toBe("Page not found · Work Board");
		},
	);
}

screenStory.it(
	"keeps the live status settled on a not-found page",
	[screenFiles(files, { home: "home.md" }), screenRoute("/_board/goals/zzz"), sessionScreen("response")],
	function* ({ readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc [data-slot=empty-title]")).toBe("Page not found")));
		yield* Effect.promise(() => eventually(() => expect(readText("#live")).toBe("Live")));
	},
);

screenStory.it(
	"says why a handoff can't be prepared without the error's type name",
	[routedScreen(files, "/_board/handoff?item=task.missing")],
	function* ({ readText }) {
		yield* Effect.promise(() =>
			eventually(() =>
				expect(readText("#doc [data-slot=alert-description]")).toBe(
					"The item is missing, ambiguous or unavailable. Earlier handoffs are still listed below.",
				),
			),
		);
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
	function* ({ readText }) {
		yield* Effect.promise(() => eventually(() => expect(readText("#doc [data-slot=empty-title]")).toBe("Two items share this ID")));
		expect(readText("#doc [data-slot=empty-description]")).toBe("Give each item its own ID in its file, then open the link again.");
		yield* Effect.promise(() => eventually(() => expect(readText("#breadcrumbs")).toBe("Workspace/ task.twice")));
	},
);
