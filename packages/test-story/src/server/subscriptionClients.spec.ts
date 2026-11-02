import { expect } from "@effect/vitest";
import { subscriptionClients } from "#test/subscriptionClients.ts";

subscriptionClients.it(
	"closing a client settles its unanswered subscription wait",
	[],
	function* ({ openClient, startWaiting, closeClient, states }) {
		yield* openClient("alice");
		const wait = yield* startWaiting();
		expect(yield* wait.state).toBe("waiting");
		expect(yield* states()).toEqual(["open"]);

		yield* closeClient("alice");
		yield* wait.finish;

		expect(yield* states()).toEqual(["closed"]);
	},
);

subscriptionClients.it(
	"closing one client leaves the wait open until the other client receives its hint",
	[],
	function* ({ openClient, startWaiting, closeClient, releasePage, states }) {
		yield* openClient("alice");
		yield* openClient("bob");
		const wait = yield* startWaiting();
		expect(yield* states()).toEqual(["open", "open"]);

		yield* closeClient("alice");

		expect(yield* states()).toEqual(["closed", "open"]);
		expect(yield* wait.state).toBe("waiting");

		yield* releasePage();
		yield* wait.finish;

		expect(yield* states()).toEqual(["closed", "answered"]);
	},
);
