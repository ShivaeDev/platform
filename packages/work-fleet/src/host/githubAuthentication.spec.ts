import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { CLI_TOKEN, ENV_TOKEN, FALLBACK_TOKEN, githubAuthentication } from "#test/githubAuthentication.ts";

for (const [name, variables, token] of [
	["GH_TOKEN ahead of GITHUB_TOKEN", { "GH_TOKEN": ENV_TOKEN, "GITHUB_TOKEN": FALLBACK_TOKEN }, ENV_TOKEN],
	["GITHUB_TOKEN when GH_TOKEN is absent", { "GITHUB_TOKEN": FALLBACK_TOKEN }, FALLBACK_TOKEN],
] as const) {
	githubAuthentication.it(`Fleet reads with ${name} without calling gh`, [], function* (story) {
		const client = yield* story.connect(variables);
		yield* client.read();
		expect(story.requests()[0]?.headers.authorization).toBe(`Bearer ${token}`);
		expect(story.commands()).toEqual([]);
	});
}

githubAuthentication.it("Fleet resolves an existing gh login once and keeps the token out of failures and diagnostics", [], function* (story) {
	const client = yield* story.connect({});
	yield* client.read();
	yield* client.read();
	expect(story.requests().map(({ headers }) => headers.authorization)).toEqual([`Bearer ${CLI_TOKEN}`, `Bearer ${CLI_TOKEN}`]);
	expect(story.commands()).toMatchObject([{ args: ["auth", "token"], command: "gh" }]);
	story.limit();
	const error = yield* client.read().pipe(Effect.flip);
	expect(error).toMatchObject({ _tag: "ServiceUnavailable" });
	expect(yield* client.observations()).toMatchObject([{ limitedBy: "rate-limit" }]);
	expect(JSON.stringify({ error, observations: yield* client.observations(), telemetry: story.telemetry() })).not.toContain(CLI_TOKEN);
});
