import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { limitsNextExchange, limitsNextRead, manyInstallations } from "#test/manyInstallations.ts";

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
	"a rate-limited token exchange blocks only that installation's authentication requests",
	[limitsNextExchange],
	function* ({ readRepositories, tokenExchanges }) {
		expect(yield* readRepositories(7)).toBe("rate limited on core until 00:02:00");

		const limited = yield* readRepositories(7);
		const other = yield* readRepositories(8);

		yield* outcomes([
			["installation 7 remains limited", () => Effect.succeed(limited), "rate limited on core until 00:02:00"],
			["installation 8 repositories", () => Effect.succeed(other), { repositories: [{ id: 8, name: "repository-8" }] }],
			[
				"token exchanges reaching GitHub",
				() => tokenExchanges(),
				[
					{ installation: 7, status: 429 },
					{ installation: 8, status: 200 },
				],
			],
		]);
	},
);
