import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { failureCode } from "#engine/failureCode.ts";
import { failureOwner } from "#engine/failureOwner.ts";
import { githubHost } from "#test/githubHostStory.ts";
import { completed, HEAD, MOVED, NO_CHANGE, PR, work } from "#test/githubResult.ts";

describe("GitHub worker result adoption", () => {
	githubHost.it("adopts the observed PR number, exact reported head and all paginated changed paths", [], function* (github) {
		const fixture = github.result();
		const result = yield* fixture.adopt(work, completed());
		expect(result).toEqual({ head: HEAD, kind: "change", paths: ["src/one.ts", "src/two.ts"], pr: PR, prNumber: 7 });
		expect(fixture.requests).toEqual([
			"repos/example/repository/pulls/7",
			"repos/example/repository/pulls/7/files?per_page=100",
			"repos/example/repository/pulls/7",
		]);
	});

	githubHost.it("adopts the unchanged head and paths when main advances during observation", [], function* (github) {
		const fixture = github.result({ after: { base: { ref: "main", sha: MOVED } }, mainHead: MOVED });
		expect(yield* fixture.adopt(work, completed())).toEqual({
			head: HEAD,
			kind: "change",
			paths: ["src/one.ts", "src/two.ts"],
			pr: PR,
			prNumber: 7,
		});
		expect(fixture.refreshes()).toBe(0);
	});

	for (const before of [{ merged: true, state: "closed" }, {}]) {
		githubHost.it(`adopts a matching merged PR before or during path observation: ${JSON.stringify(before)}`, [], function* (github) {
			const fixture = github.result({ after: { merged: true, state: "closed" }, before });
			expect(yield* fixture.adopt(work, completed())).toEqual({
				head: HEAD,
				kind: "change",
				paths: ["src/one.ts", "src/two.ts"],
				pr: PR,
				prNumber: 7,
			});
		});
	}

	for (const wrap of ["", "`"]) {
		githubHost.it(`accepts final markers with whitespace and ${wrap === "" ? "plain" : "backtick-wrapped"} values`, [], function* (github) {
			const output = `Done.\r\n \tFLEET_HEAD:  ${wrap}${HEAD}${wrap} \t\r\n \tFLEET_PR:  ${wrap}${PR}${wrap} \t\r\n`;
			expect(yield* github.result().adopt(work, completed(output))).toMatchObject({ head: HEAD, kind: "change", pr: PR });
			const noChange = output.replace(`${wrap}${PR}${wrap}`, `${wrap}none${wrap}`);
			expect(yield* github.result().adopt(work, completed(noChange))).toEqual({ evidence: [noChange], head: HEAD, kind: "no-change" });
		});
	}

	githubHost.it("records both paths of a rename", [], function* (github) {
		const fixture = github.result({ files: [[{ filename: "src/one.ts", "previous_filename": "src/old.ts" }, { filename: "src/two.ts" }]] });
		expect(yield* fixture.adopt(work, completed())).toMatchObject({ paths: ["src/old.ts", "src/one.ts", "src/two.ts"] });
	});

	githubHost.it("retains the reported no-change head and evidence when main has moved", [], function* (github) {
		const fixture = github.result({ mainHead: MOVED });
		expect(yield* fixture.adopt(work, completed(NO_CHANGE))).toEqual({ evidence: [NO_CHANGE], head: HEAD, kind: "no-change" });
		expect(fixture.refreshes()).toBe(0);
		expect(fixture.requests).toHaveLength(0);
	});

	githubHost.it("host configuration selects adoption without granting no-change validation", [], function* (github) {
		const integrations = yield* github.integrations();
		const result = yield* integrations.result(work, completed(NO_CHANGE));
		expect(result.kind).toBe("no-change");
		const failure = yield* integrations.checks(work, result).pipe(Effect.flip);
		expect(failureOwner(failure)).toBe("automation");
		expect(failureCode(failure)).toBe("no-change-checks-unconfigured");
		expect(failure).toMatchObject({
			_tag: "ServiceUnavailable",
			message: "No-change validation is not configured in this Fleet host; inspect the worker session",
		});
	});

	githubHost.it("leaves adoption unconfigured unless selected", [], function* (github) {
		const integrations = yield* github.integrations(false);
		expect(yield* integrations.result(work, completed()).pipe(Effect.flip)).toMatchObject({ _tag: "ServiceUnavailable" });
	});
});
