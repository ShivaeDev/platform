import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { it } from "@shivaedev/effect-test/it.ts";
import { daemonRequest } from "#host/daemonClient.ts";
import { requestServer } from "#test/requestServer.ts";

it.live("only a refused connection reports that no daemon is running", function* () {
	const server = yield* requestServer();
	yield* server.close;
	const failure = yield* daemonRequest(server.port, (client) => client("daemon.answer", { workId: "one" }), "answer one").pipe(Effect.flip);
	expect(failure.message).toContain("No Fleet daemon is running");
});

for (const transportTimeout of [false, true]) {
	it.live(`a listening daemon timeout names the answer and its uncertain recording: transport=${transportTimeout}`, function* () {
		const server = yield* requestServer();
		const request = daemonRequest(server.port, (client) => client("daemon.answer", { workId: "one" }), "answer one", transportTimeout ? 5000 : 100);
		const failure = yield* request.pipe(
			Effect.provideService(FetchHttpClient.Fetch, (input, options) =>
				fetch(input, {
					...options,
					...(transportTimeout ? { signal: AbortSignal.timeout(100) } : {}),
				}),
			),
			Effect.flip,
		);
		expect(server.requests()).toBe(1);
		expect(failure.message).toContain("answer one timed out");
		expect(failure.message).toContain("answer recording is unconfirmed");
		expect(failure.message).not.toContain("No Fleet daemon is running");
	});
}

it.live("a daemon server error names the answer and its uncertain recording", function* () {
	const server = yield* requestServer(500);
	const failure = yield* daemonRequest(server.port, (client) => client("daemon.answer", { workId: "one" }), "answer one").pipe(Effect.flip);
	expect(failure.message).toContain("answer one failed");
	expect(failure.message).toContain("answer recording is unconfirmed");
	expect(failure.message).not.toContain("No Fleet daemon is running");
});
