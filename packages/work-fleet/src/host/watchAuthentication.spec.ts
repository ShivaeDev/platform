import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { prWatchAuthentication, signedOut } from "#test/prWatchAuthentication.ts";

for (const [name, variables, token] of [
	["GH_TOKEN ahead of GITHUB_TOKEN", { "GH_TOKEN": "primary-token", "GITHUB_TOKEN": "fallback-token" }, "primary-token"],
	["GITHUB_TOKEN when GH_TOKEN is absent", { "GITHUB_TOKEN": "fallback-token" }, "fallback-token"],
] as const) {
	prWatchAuthentication.it(`PR watch requests use ${name} without a gh login`, [signedOut], function* (story) {
		const watcher = yield* story.start(variables);
		yield* story.poll(watcher);
		expect(story.requests()).toEqual(
			expect.arrayContaining([expect.objectContaining({ authorization: `Bearer ${token}`, path: "/repos/example/repository/pulls/7" })]),
		);
	});
}

prWatchAuthentication.it("PR watch requests use the signed-in gh token when no environment token is set", [], function* (story) {
	const watcher = yield* story.start({});
	yield* story.poll(watcher);
	expect(story.requests()).toEqual(
		expect.arrayContaining([
			expect.objectContaining({ authorization: "Bearer fleet-gh-token", path: "/repos/example/repository/pulls?state=open&per_page=100" }),
			expect.objectContaining({ authorization: "Bearer fleet-gh-token", path: "/repos/example/repository/pulls/7" }),
		]),
	);
});

prWatchAuthentication.it("PR watching refuses to start without GitHub authentication", [signedOut], function* (story) {
	const error = yield* story.start({}).pipe(Effect.flip);
	expect(error).toMatchObject({
		_tag: "ServiceUnavailable",
		message: "GitHub authentication unavailable; set GH_TOKEN or GITHUB_TOKEN, or sign in with gh",
	});
	expect(story.requests()).toEqual([]);
});
