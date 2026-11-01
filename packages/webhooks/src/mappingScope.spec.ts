import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { inbox, mappingRefusesDelivery, mappingWaitsForResource } from "#test/story.ts";

inbox.it("an accepted delivery releases its mapping's resource before answering", [], function* ({ answer, deliver, resourceLifecycle }) {
	yield* deliver("a delivery using a resource");

	yield* outcomes([
		["answer", () => answer(), "202 Accepted: queued"],
		["resource lifecycle", () => resourceLifecycle(), ["opened for issue 42", "closed for issue 42"]],
	]);
});

inbox.it("separate deliveries run their mappings in separate scopes", [], function* ({ deliver, mappingScopes }) {
	yield* deliver("a delivery using a resource");
	yield* deliver("the signed issue 43 delivery using a resource");

	expect(yield* mappingScopes()).toBe("separate");
});

inbox.it(
	"a refused delivery releases its mapping's resource before answering",
	[mappingRefusesDelivery],
	function* ({ answer, deliver, resourceLifecycle }) {
		yield* deliver("a delivery using a resource");

		yield* outcomes([
			["answer", () => answer(), "503 Service Unavailable"],
			["resource lifecycle", () => resourceLifecycle(), ["opened for issue 42", "closed for issue 42"]],
		]);
	},
);

inbox.it(
	"cancelling a mapping waiting for a resource releases its acquired resource and rolls back the receipt so a retry queues the job once",
	[mappingWaitsForResource],
	function* ({ answer, cancelResourceDelivery, deliver, handledJobs, resourceLifecycle, resourcesBecomeAvailable, startResourceDelivery }) {
		yield* startResourceDelivery();
		expect(yield* resourceLifecycle()).toEqual(["opened for issue 42"]);

		yield* cancelResourceDelivery();
		yield* resourcesBecomeAvailable();
		yield* deliver("a delivery using a resource");

		yield* outcomes([
			["retry answer", () => answer(), "202 Accepted: queued"],
			["handled jobs", () => handledJobs(), ["webhook-issue for issue 42"]],
			["resource lifecycle", () => resourceLifecycle(), ["opened for issue 42", "closed for issue 42", "opened for issue 42", "closed for issue 42"]],
		]);
	},
);
