import { expect } from "vitest";
import { manyInstallations } from "#test/manyInstallations.ts";

manyInstallations.it(
	"an installation idle for 30 minutes exchanges a new token on its next request",
	[],
	function* ({ readRepositories, tokenExchanges, timePasses }) {
		yield* readRepositories(7);
		yield* timePasses(30);

		yield* readRepositories(7);

		expect(yield* tokenExchanges()).toEqual([
			{ installation: 7, status: 200 },
			{ installation: 7, status: 200 },
		]);
	},
);

manyInstallations.it("using an installation renews its idle lifetime", [], function* ({ readRepositories, timePasses, tokenExchanges }) {
	yield* readRepositories(7);
	yield* timePasses(20);
	yield* readRepositories(7);
	yield* timePasses(20);

	yield* readRepositories(7);

	expect(yield* tokenExchanges()).toEqual([{ installation: 7, status: 200 }]);
});

manyInstallations.it(
	"the 101st installation evicts the least recently used client while preserving a recently used client",
	[],
	function* ({ readRepositories, tokenExchanges }) {
		for (let installation = 1; installation <= 100; installation += 1) {
			yield* readRepositories(installation);
		}
		yield* readRepositories(1);

		yield* readRepositories(101);

		yield* readRepositories(1);
		yield* readRepositories(2);
		expect((yield* tokenExchanges()).slice(100)).toEqual([
			{ installation: 101, status: 200 },
			{ installation: 2, status: 200 },
		]);
	},
);

manyInstallations.it(
	"an active installation refreshes its expiring token while a newer installation keeps its token",
	[],
	function* ({ readRepositories, timePasses, tokenExchanges }) {
		yield* readRepositories(7);
		yield* timePasses(20);
		yield* readRepositories(7);
		yield* readRepositories(8);
		yield* timePasses(20);
		yield* readRepositories(7);
		yield* readRepositories(8);
		yield* timePasses(15);

		yield* readRepositories(7);
		yield* readRepositories(8);

		expect(yield* tokenExchanges()).toEqual([
			{ installation: 7, status: 200 },
			{ installation: 8, status: 200 },
			{ installation: 7, status: 200 },
		]);
	},
);
