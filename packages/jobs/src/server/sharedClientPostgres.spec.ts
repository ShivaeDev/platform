import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { sharedClient } from "#test/sharedClient.ts";

sharedClient.it(
	"registration, worker and producer share one client that delivers work and closes once",
	[],
	function* ({ publish, deliveredMessage, registeredQueues, lifecycle, close }) {
		expect(yield* lifecycle()).toEqual({ created: 1, stopped: 0 });

		yield* publish("work from the shared producer");

		yield* outcomes({
			"registration health": [registeredQueues(), ["shared-client"]],
			"worker delivery": [deliveredMessage(), "work from the shared producer"],
		});

		yield* close();

		expect(yield* lifecycle()).toEqual({ created: 1, stopped: 1 });
	},
);
