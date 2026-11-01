import { Effect } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { appGithub } from "#test/appGithub.ts";
import { github } from "#test/github.ts";
import { holdsPooledInstallationToken, unfinishedAppResponse, unfinishedChunkedPull, unfinishedPull } from "#test/rejectedBodies.ts";

for (const [status, headers, outcome] of [
	[404, {}, "not found"],
	[429, { "retry-after": "120" }, "rate limited on core until 00:02:00"],
	[403, { "retry-after": "120", "x-ratelimit-remaining": "0" }, "rate limited on core until 00:02:00"],
	[200, { "content-length": "1000" }, "body over 10 bytes"],
] as const) {
	github.it(
		`a ${status} refusal releases an unfinished GitHub body`,
		[unfinishedPull(status, headers)],
		function* ({ bodyReleased, readPullWithin }) {
			const result = yield* readPullWithin(10);
			yield* outcomes([
				["failure", () => Effect.succeed(result), outcome],
				["body", bodyReleased, "released"],
			]);
		},
	);
}

github.it("a chunked overflow releases the unfinished GitHub body", [unfinishedChunkedPull], function* ({ bodyReleased, readPullWithin }) {
	const result = yield* readPullWithin(10);
	yield* outcomes([
		["failure", () => Effect.succeed(result), "body over 10 bytes"],
		["body", bodyReleased, "released"],
	]);
});

appGithub.it(
	"refreshing a rejected installation token releases the unfinished 401 response",
	[holdsPooledInstallationToken, unfinishedAppResponse("pull", { status: 401 })],
	function* ({ bodyReleased, readPullFromOneConnectionPool, tokensIssued }) {
		const result = yield* readPullFromOneConnectionPool();
		yield* outcomes([
			["pull", () => Effect.succeed(result), { number: 1, title: "App read" }],
			["tokens", tokensIssued, ["installation token 1", "installation token 2"]],
			["rejected body", () => bodyReleased("/repos/acme/widgets/pulls/1"), "released"],
		]);
	},
);

for (const [reply, outcome] of [
	[{ status: 401 }, "token exchange refused with HTTP 401"],
	[{ headers: { "content-length": "100000" } }, "token exchange response failed"],
] as const) {
	appGithub.it(
		`an unfinished token exchange that fails as ${outcome} releases its body`,
		[unfinishedAppResponse("token", reply)],
		function* ({ bodyReleased, readPull }) {
			const result = yield* readPull();
			yield* outcomes([
				["failure", () => Effect.succeed(result), outcome],
				["body", () => bodyReleased("/app/installations/7/access_tokens"), "released"],
			]);
		},
	);
}

appGithub.it(
	"a rejected installation lookup releases its unfinished body",
	[unfinishedAppResponse("installation", { status: 401 })],
	function* ({ bodyReleased, readRepositoryPull }) {
		const result = yield* readRepositoryPull();
		yield* outcomes([
			["failure", () => Effect.succeed(result), "token exchange refused with HTTP 401"],
			["body", () => bodyReleased("/repos/acme/widgets/installation"), "released"],
		]);
	},
);
