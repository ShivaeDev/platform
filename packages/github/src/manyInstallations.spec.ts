import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { bothInstallationsUsed, limitsNextRead, manyInstallations, refusesNextExchange, rejectsNextRead } from "#test/manyInstallations.ts";

manyInstallations.it(
	"one App Layer serves two installations with separate tokens and conditional representations",
	[],
	function* ({ readRepositories, tokenExchanges, repositoryRequests }) {
		const first = yield* readRepositories(7);
		const second = yield* readRepositories(8);
		yield* outcomes([
			["installation 7 repositories", () => Effect.succeed(first), { repositories: [{ id: 7, name: "repository-7" }] }],
			["installation 8 repositories", () => Effect.succeed(second), { repositories: [{ id: 8, name: "repository-8" }] }],
		]);

		yield* readRepositories(7);
		yield* readRepositories(8);

		yield* outcomes([
			[
				"token exchanges",
				() => tokenExchanges(),
				[
					{ installation: 7, status: 200 },
					{ installation: 8, status: 200 },
				],
			],
			[
				"conditional requests",
				() => repositoryRequests(),
				[{ etag: "none" }, { etag: "none" }, { etag: '"installation-7"' }, { etag: '"installation-8"' }],
			],
		]);
	},
);

manyInstallations.it(
	"a 401 refreshes only the rejected installation's token",
	[bothInstallationsUsed, rejectsNextRead],
	function* ({ readRepositories, tokenExchanges }) {
		const first = yield* readRepositories(7);
		const second = yield* readRepositories(8);

		yield* outcomes([
			["installation 7 repositories", () => Effect.succeed(first), { repositories: [{ id: 7, name: "repository-7" }] }],
			["installation 8 repositories", () => Effect.succeed(second), { repositories: [{ id: 8, name: "repository-8" }] }],
			[
				"token exchanges",
				() => tokenExchanges(),
				[
					{ installation: 7, status: 200 },
					{ installation: 8, status: 200 },
					{ installation: 7, status: 200 },
				],
			],
		]);
	},
);

manyInstallations.it(
	"a rate-limited installation stays blocked locally while another installation reads",
	[limitsNextRead],
	function* ({ readRepositories, repositoryRequests, tokenExchanges }) {
		expect(yield* readRepositories(7)).toBe("rate limited on core until 00:02:00");

		const limited = yield* readRepositories(7);
		const other = yield* readRepositories(8);

		yield* outcomes([
			["installation 7 remains limited", () => Effect.succeed(limited), "rate limited on core until 00:02:00"],
			["installation 8 repositories", () => Effect.succeed(other), { repositories: [{ id: 8, name: "repository-8" }] }],
			["requests reaching GitHub", () => repositoryRequests(), [{ status: 429 }, { status: 200 }]],
			[
				"token exchanges",
				() => tokenExchanges(),
				[
					{ installation: 7, status: 200 },
					{ installation: 8, status: 200 },
				],
			],
		]);
	},
);

manyInstallations.it(
	"a refused exchange does not poison either installation's next request",
	[refusesNextExchange],
	function* ({ readRepositories, tokenExchanges }) {
		expect(yield* readRepositories(7)).toBe("token exchange refused with HTTP 401");

		const second = yield* readRepositories(8);
		const first = yield* readRepositories(7);

		yield* outcomes([
			["installation 8 repositories", () => Effect.succeed(second), { repositories: [{ id: 8, name: "repository-8" }] }],
			["installation 7 repositories", () => Effect.succeed(first), { repositories: [{ id: 7, name: "repository-7" }] }],
			[
				"token exchanges",
				() => tokenExchanges(),
				[
					{ installation: 7, status: 401 },
					{ installation: 8, status: 200 },
					{ installation: 7, status: 200 },
				],
			],
		]);
	},
);

manyInstallations.it(
	"concurrent first reads share one token exchange per installation and return each installation's repositories",
	[],
	function* ({ readTogether, exchangeTally }) {
		const answers = yield* readTogether([7, 8, 7, 8]);

		yield* outcomes([
			[
				"repository answers",
				() => Effect.succeed(answers),
				[
					{ repositories: [{ id: 7, name: "repository-7" }] },
					{ repositories: [{ id: 8, name: "repository-8" }] },
					{ repositories: [{ id: 7, name: "repository-7" }] },
					{ repositories: [{ id: 8, name: "repository-8" }] },
				],
			],
			["token exchanges per installation", () => exchangeTally(), { "7": 1, "8": 1 }],
		]);
	},
);
