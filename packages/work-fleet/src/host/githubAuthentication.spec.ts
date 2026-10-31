import { expect } from "@effect/vitest";
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

githubAuthentication.it("Fleet resolves an existing gh login once for every read", [], function* (story) {
	const client = yield* story.connect({});
	yield* client.read();

	yield* client.read();

	expect({
		authorizations: story.requests().map(({ headers }) => headers.authorization),
		commands: story.commands(),
	}).toMatchObject({ authorizations: [`Bearer ${CLI_TOKEN}`, `Bearer ${CLI_TOKEN}`], commands: [{ args: ["auth", "token"], command: "gh" }] });
});

githubAuthentication.it(
	"a rate-limited read with a gh login fails as unavailable and keeps the token out of the failure and diagnostics",
	[],
	function* (story) {
		const client = yield* story.connect({});
		yield* client.read();
		story.limit();

		const failure = yield* client.readFailure();

		const observations = yield* client.observations();
		expect({
			described: failure.described,
			diagnostics: JSON.stringify({ error: failure.serialized, observations, telemetry: story.telemetry() }),
			limitedBy: observations.map(({ limitedBy }) => limitedBy),
		}).toEqual({
			described: expect.stringMatching(/^unavailable: /u),
			diagnostics: expect.not.stringContaining(CLI_TOKEN),
			limitedBy: ["rate-limit"],
		});
	},
);
