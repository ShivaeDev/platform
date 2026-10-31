import { expect } from "vitest";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { NoteMissing } from "#test/routerClient.ts";
import { firstNoteShown, loaderFailed, pageTwoRequested, retryRequested, routeRequested, routes, secondNoteRequested } from "#test/routerStories.tsx";

for (const initial of ["/notes/first", "/notes/first?page=invalid"]) {
	routes.it(`opening ${initial} requests the validated default page 1`, [routeRequested(initial)], function* ({ requests }) {
		expect(yield* requests()).toEqual(["first page 1"]);
	});

	routes.it(
		`at ${initial} the default page's answer is the query's first rendered frame, with no second request`,
		[routeRequested(initial)],
		function* ({ answer, firstFrame, queryText, requests }) {
			yield* answer("first", "First page");

			yield* outcomes({
				"first frame": [firstFrame(), "First page"],
				query: [queryText(), "First page"],
				requests: [requests(), ["first page 1"]],
			});
		},
	);
}

routes.it(
	"a NotFound answer shows its server message on the root not-found screen without an alert",
	[routeRequested("/notes/missing")],
	function* ({ alert, heading, reject }) {
		yield* reject("missing", new NotFound({ message: "This note was removed by its owner" }));

		yield* outcomes({
			alert: [alert(), "none"],
			heading: [heading(), "This note was removed by its owner"],
		});
	},
);

routes.it(
	"a route-level not-found screen wins over the shared root screen for a NotFound answer",
	[routeRequested("/custom-notes/missing")],
	function* ({ heading, reject }) {
		yield* reject("missing", new NotFound({ message: "This note was removed by its owner" }));

		expect(yield* heading()).toBe("Note not found");
	},
);

routes.it("changing the page requests the query with the new page", [firstNoteShown("First page")], function* ({ changePage, requests }) {
	yield* changePage(2);

	expect(yield* requests()).toEqual(["first page 1", "first page 2"]);
});

routes.it("the changed page's answer is the query's shown text", [pageTwoRequested()], function* ({ answer, queryText }) {
	yield* answer("first", "Second page", 2);

	expect(yield* queryText()).toBe("Second page");
});

routes.it(
	"a route's loader and its rendered query share one request and one client runtime",
	[routeRequested()],
	function* ({ answer, clientRuntimes, heading, queryText, requests }) {
		yield* answer("first", "First note");

		yield* outcomes({
			"client runtimes": [clientRuntimes(), 1],
			heading: [heading(), "First note"],
			query: [queryText(), "First note"],
			requests: [requests(), ["first page 1"]],
		});
	},
);

const missing = new NoteMissing({ id: "missing" });
routes.it(
	"a declared RPC failure reaches the route's error component as its tagged error",
	[routeRequested("/notes/missing", missing)],
	function* ({ alert, reject, routeError }) {
		yield* reject("missing", missing);

		yield* outcomes({
			alert: [alert(), "NoteMissing:missing"],
			"route error": [routeError(), missing],
		});
	},
);

routes.it(
	"navigating to another note keeps showing the current note while the new one loads",
	[firstNoteShown("First note")],
	function* ({ heading, navigating, openSecondNote, queryText, requests }) {
		yield* openSecondNote();

		yield* outcomes({
			heading: [heading(), "First note"],
			navigating: [navigating(), "true"],
			query: [queryText(), "First note"],
			requests: [requests(), ["first page 1", "second page 1"]],
		});
	},
);

routes.it(
	"the new note's answer replaces the shown note and ends navigation on the same client runtime",
	[secondNoteRequested()],
	function* ({ answer, clientRuntimes, heading, navigating, queryText }) {
		yield* answer("second", "Second note");

		yield* outcomes({
			"client runtimes": [clientRuntimes(), 1],
			heading: [heading(), "Second note"],
			navigating: [navigating(), "false"],
			query: [queryText(), "Second note"],
		});
	},
);

const retryFailure = new NoteMissing({ id: "first" });

routes.it(
	"Retry after a loader failure requests the note again inside the same shell",
	[loaderFailed(retryFailure, "Keep this draft")],
	function* ({ requests, retry, shell }) {
		yield* retry();

		yield* outcomes({
			requests: [requests(), ["first page 1", "first page 1"]],
			shell: [shell(), { draft: "Keep this draft", input: "original", shell: "original" }],
		});
	},
);

routes.it(
	"a retry that answers shows the recovered note, removes the alert and keeps the shell with its draft",
	[retryRequested(retryFailure, "Keep this draft")],
	function* ({ alert, answer, heading, shell }) {
		yield* answer("first", "Recovered note");

		yield* outcomes({
			alert: [alert(), "none"],
			heading: [heading(), "Recovered note"],
			shell: [shell(), { draft: "Keep this draft", input: "original", shell: "original" }],
		});
	},
);

routes.it(
	"the query factory reads the client and viewer from router context to load the viewer's data",
	[routeRequested("/notes/first", undefined, 3)],
	function* ({ answer, queryText, requests }) {
		yield* answer("first", "Viewer's note", 3);

		yield* outcomes({
			query: [queryText(), "Viewer's note"],
			requests: [requests(), ["first page 3"]],
		});
	},
);

routes.it(
	"a reloaded query factory reads the current viewer context",
	[firstNoteShown("First viewer's note")],
	function* ({ answer, changeViewer, queryText }) {
		expect(yield* queryText()).toBe("First viewer's note");

		yield* changeViewer(2);
		yield* answer("first", "Second viewer's note", 2);

		expect(yield* queryText()).toBe("Second viewer's note");
	},
);
