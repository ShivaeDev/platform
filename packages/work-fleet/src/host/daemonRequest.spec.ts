import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { fleetDaemon } from "#test/daemonStory.ts";

fleetDaemon.it("only a refused connection reports that no daemon is running", [], function* (daemon) {
	const server = yield* daemon.requestPeer();
	yield* server.close;
	const failure = yield* daemon.answerPeer(server.port).pipe(Effect.flip);
	expect(failure.message).toContain("No Fleet daemon is running");
});

for (const transportTimeout of [false, true]) {
	fleetDaemon.it(`a listening daemon timeout names the answer and its uncertain recording: transport=${transportTimeout}`, [], function* (daemon) {
		const server = yield* daemon.requestPeer();
		const failure = yield* daemon.answerPeer(server.port, transportTimeout ? 5000 : 100, transportTimeout).pipe(Effect.flip);
		expect(server.requests()).toBe(1);
		expect(failure.message).toContain("answer one timed out");
		expect(failure.message).toContain("answer recording is unconfirmed");
		expect(failure.message).not.toContain("No Fleet daemon is running");
	});
}

fleetDaemon.it("a daemon server error names the answer and its uncertain recording", [], function* (daemon) {
	const server = yield* daemon.requestPeer(500);
	const failure = yield* daemon.answerPeer(server.port).pipe(Effect.flip);
	expect(failure.message).toContain("answer one failed");
	expect(failure.message).toContain("answer recording is unconfirmed");
	expect(failure.message).not.toContain("No Fleet daemon is running");
});
