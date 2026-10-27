import { expect } from "vitest";
import { environmentTokens, signedInGh, signedOutGh } from "#test/authentication.ts";
import { watch } from "#test/watch.ts";

for (const [name, variables, token] of [
	["GH_TOKEN ahead of GITHUB_TOKEN", { "GH_TOKEN": "primary-token", "GITHUB_TOKEN": "fallback-token" }, "primary-token"],
	["GITHUB_TOKEN when GH_TOKEN is absent", { "GITHUB_TOKEN": "fallback-token" }, "fallback-token"],
] as const) {
	watch.it(`the CLI watches with ${name} without a gh login`, [signedOutGh, environmentTokens(variables)], function* (story) {
		const result = yield* story.cliRun("1", "--once");
		expect(result.code).toBe(0);
		expect(story.requests).toEqual(
			expect.arrayContaining([expect.objectContaining({ authorization: `Bearer ${token}`, path: "/repos/acme/project/pulls/1" })]),
		);
	});
}

watch.it("the CLI watches with the signed-in gh token when no environment token is set", [signedInGh("pr-watch-gh-token")], function* (story) {
	const result = yield* story.cliRun("1", "--once");
	expect(result.code).toBe(0);
	expect(story.requests).toEqual(
		expect.arrayContaining([expect.objectContaining({ authorization: "Bearer pr-watch-gh-token", path: "/repos/acme/project/pulls/1" })]),
	);
});

watch.it("the CLI refuses to watch without GitHub authentication", [signedOutGh], function* (story) {
	const result = yield* story.cliRun("1", "--once");
	const exitCode = result.code;
	expect(exitCode).toBe(1);
	expect(result.stderr).toContain("GitHub authentication unavailable; set GH_TOKEN or GITHUB_TOKEN, or sign in with gh");
	expect(story.requests).toEqual([]);
});
