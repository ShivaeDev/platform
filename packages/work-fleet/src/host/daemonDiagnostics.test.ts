import { expect } from "vitest";
import { ServiceUnavailable } from "@shivaedev/contract/errors/taxonomy.ts";
import { fleetDaemon } from "#test/daemonStory.ts";

fleetDaemon.it("Fleet store failures reach HTTP RPC clients as ServiceUnavailable", [], function* (daemon) {
	const failure = yield* daemon.unavailableFleetItems();
	expect(failure).toBeInstanceOf(ServiceUnavailable);
	expect(failure.message).toBe("The integration is unavailable; inspect runtime diagnostics");
});
