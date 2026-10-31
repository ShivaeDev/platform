import { describe, expect } from "@effect/vitest";
import { githubHost } from "#test/githubHostStory.ts";
import { completed, HEAD, MOVED, NO_CHANGE, PR, work } from "#test/githubResult.ts";
import { refusal } from "#test/refusal.ts";

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

	githubHost.it("leaves adoption unconfigured unless selected", [], function* (github) {
		const integrations = yield* github.integrations(false);
		expect(yield* refusal(integrations.result(work, completed()))).toMatch(/^unavailable: /u);
	});
});
