import { expect } from "vitest";
import { parkedMergeDaemon } from "#test/parkedMergeDaemon.ts";

for (const action of ["restart", "sweep"] as const) {
	parkedMergeDaemon.it(`queues every parked reviewed PR on ${action} without a new PR event`, [], function* (daemon) {
		for (const id of ["one", "two"]) {
			expect(yield* daemon.get(id)).toMatchObject({
				checks: { passed: true },
				decision: { reason: "Reviewed PR is ready to merge" },
				step: "waiting",
			});
		}
		expect(daemon.queuedPullRequests()).toEqual([]);
		yield* daemon[action]();
		for (const id of ["one", "two"]) {
			expect(yield* daemon.waitForQueued(id)).toMatchObject({
				attentionOwner: "automation",
				mergeQueue: { head: `reviewed-${id}`, status: "queued" },
			});
		}
		expect(daemon.queuedPullRequests().toSorted()).toEqual([
			["1", "reviewed-one"],
			["2", "reviewed-two"],
		]);
		yield* daemon.sweep();
		expect(
			daemon
				.queueRequests()
				.map((request) => request.variables)
				.toSorted((left, right) => left.pr.localeCompare(right.pr)),
		).toEqual([
			{ head: "reviewed-one", pr: "1" },
			{ head: "reviewed-two", pr: "2" },
		]);
	});
}
