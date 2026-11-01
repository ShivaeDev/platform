import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { GitHubRateLimited } from "#errors.ts";
import { appGithub } from "#test/appGithub.ts";
import { appRateLimited } from "#test/appRateLimitTraits.ts";

for (const [route, operation, refused, success] of [
	["app", "readApp", "GET /app 403 with an App JWT", { appId: 123_456, slug: "widgets-app" }],
	["installation", "readRepositoryPull", "GET /repos/acme/widgets/installation 403 with an App JWT", { number: 1, title: "App read" }],
	["token", "readPull", "POST /app/installations/7/access_tokens 403 with an App JWT", { number: 1, title: "App read" }],
] as const) {
	for (const [limit, seconds, deadline] of [
		["primary", 120, "00:02:00"],
		["secondary", 30, "00:00:30"],
		["message", 60, "00:01:00"],
	] as const) {
		appGithub.it(
			`${route} ${limit} quota exhaustion returns typed GitHubRateLimited until ${deadline}`,
			[appRateLimited(route, limit)],
			function* (verbs) {
				const answer = yield* verbs[operation]();

				expect(answer).toBe(`rate limited on core until ${deadline}`);
				expect((yield* verbs.appFailures())[0]).toBeInstanceOf(GitHubRateLimited);
			},
		);

		appGithub.it(
			`${route} ${limit} quota exhaustion blocks requests locally until ${deadline} and permits them at the deadline`,
			[appRateLimited(route, limit)],
			function* (verbs) {
				yield* verbs[operation]();
				const refusal = refused.replace(" 403 ", limit === "secondary" ? " 429 " : " 403 ");
				expect(yield* verbs.requests()).toEqual([refusal]);
				yield* verbs.timePasses(`${seconds - 1} seconds`);

				yield* outcomes([
					["answer", () => verbs[operation](), `rate limited on core until ${deadline}`],
					["requests reaching GitHub", () => verbs.requests(), [refusal]],
				]);

				yield* verbs.timePasses("1 second");

				expect(yield* verbs[operation]()).toEqual(success);
			},
		);
	}

	appGithub.it(
		`${route} consecutive message-only rate limits back off from one minute to two minutes`,
		[appRateLimited(route, "message", true)],
		function* (verbs) {
			expect(yield* verbs[operation]()).toBe("rate limited on core until 00:01:00");
			yield* verbs.timePasses("1 minute");

			expect(yield* verbs[operation]()).toBe("rate limited on core until 00:03:00");
		},
	);
}

appGithub.it(
	"rate-limited token exchanges keep App credentials out of serialized failures, logs and spans",
	[appRateLimited("token", "primary")],
	function* ({ credentialsSeenIn, readPull }) {
		yield* readPull();

		yield* outcomes([
			["answer", () => readPull(), "rate limited on core until 00:02:00"],
			["credentials seen in", () => credentialsSeenIn(), {}],
		]);
	},
);
