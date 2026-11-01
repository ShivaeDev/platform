import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { aliceCredentialsSet, browser } from "#test/browser.ts";
import { addIsBlocked, liveBrowser, navigationFails, nonRpcFrame } from "#test/liveBrowser.ts";

browser.it(
	"a check of / and /notes visits both pages in order and saves each as a numbered PNG screenshot",
	[],
	function* ({ checks, pagesVisited, screenshots }) {
		yield* checks("--page", "/", "--page", "/notes");

		yield* outcomes([
			["pages the app served", () => pagesVisited(), ["/", "/notes"]],
			["screenshots", () => screenshots(), ["1.png: a PNG image", "2.png: a PNG image"]],
		]);
	},
);

browser.it("a check whose text shows on every page passes with a smoke pass for each page", [], function* ({ checks, outcome, smokeChecks }) {
	yield* checks("--page", "/", "--page", "/notes", "--text", "Local app");

	yield* outcomes([
		["outcome", () => outcome(), "passed"],
		["smoke checks", () => smokeChecks(), ["smoke passed (the app/)", "smoke passed (the app/notes)"]],
	]);
});

browser.it("a hidden first text match is skipped when later matches are visible", [], function* ({ checks, outcome }) {
	yield* checks("--page", "/hidden-first", "--text", "Expected text");

	expect(yield* outcome()).toBe("passed");
});

for (const url of ["not-a-url", "file:///tmp/page.html"]) {
	browser.it(
		`an invalid --url ${url} fails with a diagnostic before opening a browser`,
		[],
		function* ({ checksAt, outcome, browserActivity, screenshots }) {
			yield* checksAt(url);

			yield* outcomes([
				["outcome", () => outcome(), "failed: Invalid --url: expected an absolute HTTP(S) URL."],
				["browser activity", () => browserActivity(), []],
				["screenshots", () => screenshots(), []],
			]);
		},
	);
}

browser.it(
	"an invalid later --page fails with a diagnostic before opening a browser or visiting earlier pages",
	[],
	function* ({ checks, outcome, browserActivity, pagesVisited }) {
		yield* checks("--page", "/", "--page", "http://[");

		yield* outcomes([
			["outcome", () => outcome(), "failed: Invalid --page: expected an HTTP(S) URL or page path."],
			["browser activity", () => browserActivity(), []],
			["pages visited", () => pagesVisited(), []],
		]);
	},
);

browser.it(
	"with alice's credentials set, the check signs in as alice and her session opens her account page",
	[aliceCredentialsSet()],
	function* ({ checks, outcome, signIns }) {
		yield* checks("--page", "/account", "--text", "Alice's account");

		yield* outcomes([
			["outcome", () => outcome(), "passed"],
			["sign-ins", () => signIns(), ["alice@example.com with password alice-password"]],
		]);
	},
);

for (const [name, args, failure] of [
	[
		"live notes without test-user credentials",
		["--live-notes"],
		"--live-notes requires BROWSER_CHECK_EMAIL and BROWSER_CHECK_PASSWORD for an existing disposable user.",
	],
	["a page that answers HTTP 404", ["--page", "/missing"], "Error: Page the app/missing returned HTTP 404."],
	["text absent from the page", ["--text", "Text absent from the app"], "TimeoutError: locator.waitFor: Timeout 5000ms exceeded."],
	[
		"text whose only match is hidden",
		["--page", "/hidden-only", "--text", "Expected text"],
		"TimeoutError: locator.waitFor: Timeout 5000ms exceeded.",
	],
] as const) {
	browser.it(`a check of ${name} fails with "${failure}"`, [], function* ({ checks, outcome }) {
		yield* checks(...args);

		expect(yield* outcome()).toBe(`failed: ${failure}`);
	});
}

liveBrowser.it(
	"failed navigation leaves no unhandled live-wait rejection after the tabs close",
	[navigationFails()],
	function* ({ checksLiveNotes, closesTabs, outcome, unhandledRejections }) {
		yield* checksLiveNotes();
		yield* closesTabs();

		yield* outcomes([
			["check", () => outcome(), "failed"],
			["unhandled rejections", () => unhandledRejections(), []],
		]);
	},
);

liveBrowser.it(
	"a live-wait timeout during an unfinished add leaves no unhandled rejection",
	[addIsBlocked()],
	function* ({ checksLiveNotes, closesTabs, outcome, unhandledRejections }) {
		yield* checksLiveNotes();
		yield* closesTabs();

		yield* outcomes([
			["check", () => outcome(), "failed"],
			["unhandled rejections", () => unhandledRejections(), []],
		]);
	},
);

liveBrowser.it(
	"closing tabs during an unfinished add fails the check without an unhandled rejection",
	[addIsBlocked()],
	function* ({ startsLiveCheck, waitsForDraft, closesTabs, outcome, unhandledRejections }) {
		yield* startsLiveCheck();
		yield* waitsForDraft();

		yield* closesTabs();

		yield* outcomes([
			["check", () => outcome(), "failed"],
			["unhandled rejections", () => unhandledRejections(), []],
		]);
	},
);

for (const kind of ["Resync", "Changed", "notes.list"] as const) {
	liveBrowser.it(`a non-RPC ${kind} frame cannot verify the live check`, [nonRpcFrame(kind)], function* ({ checksLiveNotes, closesTabs, outcome }) {
		yield* checksLiveNotes();
		yield* closesTabs();

		expect(yield* outcome()).toBe("failed");
	});
}

liveBrowser.it("RPC hints and a list request verify the two-tab live check", [], function* ({ checksLiveNotes, outcome }) {
	yield* checksLiveNotes();

	expect(yield* outcome()).toBe("passed");
});
