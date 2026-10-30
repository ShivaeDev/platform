import { Schema } from "effect";
import { expect } from "vitest";
import { DIFF, LOGO } from "#test/fakeRepository.ts";
import { github } from "#test/github.ts";
import { pullBreaksSchema, pullMissing, repositoryHasPullRequests } from "#test/traits.ts";

const NumberAsText = Schema.Struct({ number: Schema.String });

github.it("reading pull request 1 returns it decoded with the caller's Schema", [], function* ({ readPull }) {
	expect(yield* readPull()).toEqual({ number: 1, title: "Pull request 1" });
});

github.it("a read sends GitHub's JSON media type, API version and the configured token", [], function* ({ headersSent, readPull }) {
	yield* readPull();

	expect(yield* headersSent()).toEqual([{ accept: "application/vnd.github+json", apiVersion: "2022-11-28", credential: "the configured token" }]);
});

github.it("GitHub's 404 for pull request 1 fails the read as not found", [pullMissing], function* ({ readPull }) {
	expect(yield* readPull()).toBe("not found");
});

github.it("JSON that breaks the caller's Schema fails the read as a Schema mismatch", [pullBreaksSchema], function* ({ readPull }) {
	expect(yield* readPull()).toBe("Schema mismatch");
});

github.it("reading unchanged pull request 1 again sends the ETag GitHub gave it", [], function* ({ readPull, revalidations }) {
	yield* readPull();
	expect(yield* revalidations()).toEqual(["no ETag"]);

	yield* readPull();

	expect(yield* revalidations()).toEqual(["no ETag", '"pull-1"']);
});

github.it("a read GitHub answers with 304 Not Modified returns the value the first read decoded", [], function* ({ readPull }) {
	const first = yield* readPull();

	const again = yield* readPull();

	expect(again).toBe(first);
});

github.it(
	"a read GitHub answers with 304 Not Modified still fails as too large under a limit smaller than the cached body",
	[],
	function* ({ readPull, readPullWithin }) {
		yield* readPull();

		expect(yield* readPullWithin(8)).toBe("body over 8 bytes");
	},
);

github.it(
	"a revalidated pull request read through a Schema that wants its number as text fails as a Schema mismatch",
	[],
	function* ({ readPull, readPullAs }) {
		yield* readPull();

		expect(yield* readPullAs("a number written as text", NumberAsText)).toBe("Schema mismatch");
	},
);

github.it(
	"after reads of 1001 pull requests the client still revalidates the latest and no longer revalidates the first",
	[],
	function* ({ readPull, revalidations }) {
		for (let number = 1; number <= 1001; number += 1) {
			yield* readPull(number);
		}

		yield* readPull(1001);
		yield* readPull(1);

		expect((yield* revalidations()).slice(-2)).toEqual(['"pull-1001"', "no ETag"]);
	},
	20_000,
);

github.it("listing five pull requests returns all five across GitHub's Link pages", [repositoryHasPullRequests(5)], function* ({ listPulls }) {
	expect(yield* listPulls()).toEqual([1, 2, 3, 4, 5].map((number) => ({ number, title: `Pull request ${number}` })));
});

github.it(
	"taking one pull request from a list of five requests only the first page",
	[repositoryHasPullRequests(5)],
	function* ({ listPulls, pagesRequested }) {
		yield* listPulls(1);

		expect(yield* pagesRequested()).toEqual([1]);
	},
);

github.it(
	"a paced list calls its pacing callback with the core budget before each of its three page requests",
	[repositoryHasPullRequests(5)],
	function* ({ listPullsPaced, pacingCalls }) {
		yield* listPullsPaced();

		expect(yield* pacingCalls()).toEqual(["core", "core", "core"]);
	},
);

github.it(
	"a pacing callback that refuses its second call fails the list with its refusal",
	[repositoryHasPullRequests(5)],
	function* ({ listPullsPaced }) {
		expect(yield* listPullsPaced(2)).toBe("unavailable: pacing budget spent");
	},
);

github.it(
	"a pacing callback that refuses its second call stops the list before page 2 is requested",
	[repositoryHasPullRequests(5)],
	function* ({ listPullsPaced, pagesRequested }) {
		yield* listPullsPaced(2);

		expect(yield* pagesRequested()).toEqual([1]);
	},
);

github.it("reading pull request 1 with GitHub's diff media type returns the diff text", [], function* ({ readDiff }) {
	expect(yield* readDiff()).toBe(DIFF);
});

github.it("reading logo.png with GitHub's raw media type returns its bytes", [], function* ({ readLogo }) {
	expect(yield* readLogo()).toEqual(LOGO);
});

github.it("a diff longer than the caller's 10-byte limit fails as too large", [], function* ({ readDiff }) {
	expect(yield* readDiff(10)).toBe("body over 10 bytes");
});

github.it("raw bytes longer than the caller's 4-byte limit fail as too large", [], function* ({ readLogo }) {
	expect(yield* readLogo(4)).toBe("body over 4 bytes");
});

github.it("opening an issue POSTs its title as JSON and returns GitHub's decoded issue", [], function* ({ writeIssue }) {
	expect(yield* writeIssue("POST", "Fix the flaky test")).toEqual({ number: 6, title: "Fix the flaky test" });
});

github.it("opening an issue sends GitHub's JSON media type, API version and the configured token", [], function* ({ headersSent, writeIssue }) {
	yield* writeIssue("POST", "Fix the flaky test");

	expect(yield* headersSent()).toEqual([{ accept: "application/vnd.github+json", apiVersion: "2022-11-28", credential: "the configured token" }]);
});

github.it("retitling issue 2 PATCHes its title as JSON and returns GitHub's decoded issue", [], function* ({ writeIssue }) {
	expect(yield* writeIssue("PATCH", "Fix the flaky test")).toEqual({ number: 2, title: "Fix the flaky test" });
});
