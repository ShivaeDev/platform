import { Effect } from "effect";
import { expect } from "vitest";
import { socketStory } from "#test/socketStory.ts";

for (const code of ["ECONNRESET", "EPIPE"]) {
	socketStory.it(`closes synthetic provider sockets after expected peer disconnect ${code}`, [], function* ({ peerError, close, socketCount }) {
		peerError(Object.assign(new Error("Peer exited"), { code }));
		yield* close();
		expect(socketCount()).toBe(0);
	});
}
socketStory.it("fails fixture cleanup for unexpected socket errors", [], function* ({ peerError, close, socketCount }) {
	const error = Object.assign(new Error("Unexpected transport failure"), { code: "EOTHER" });
	peerError(error);
	expect((yield* close().pipe(Effect.flip)).cause).toMatchObject({ errors: [error] });
	expect(socketCount()).toBe(0);
});
