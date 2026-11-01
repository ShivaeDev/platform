import { createServer } from "node:http";
import { Deferred, Effect, Fiber } from "effect";
import { perAttempt } from "./specFiles.ts";
import { runProgram, type Suite, writeFile } from "./suite.ts";

export const holdRerun = Effect.fn("VitestRerunSuite.holdRerun")(function* (suite: Suite) {
	const server = yield* Effect.acquireRelease(
		Effect.sync(() =>
			createServer((_request, response) => {
				response.end();
				Effect.runSync(Deferred.succeed(suite.attemptPending, undefined));
			}),
		),
		(opened) =>
			Effect.promise(
				() =>
					new Promise<void>((resolve, reject) => {
						opened.closeAllConnections();
						opened.close((error) => (error === undefined ? resolve() : reject(error)));
					}),
			),
	);
	yield* Effect.promise(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)));
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("The pending attempt needs a TCP address");
	}
	writeFile(
		suite,
		"pending.spec.ts",
		perAttempt(`
it('waits in its rerun', async () => {
	if (attempt === 1) {
		throw new Error('The first attempt fails');
	}
	await fetch('http://127.0.0.1:${address.port}');
	await new Promise(() => {});
});
`),
	);
});

export function pendingVerbs(suite: Suite) {
	return {
		interruptRun: () =>
			Effect.gen(function* () {
				const fiber = suite.pendingRun.fiber;
				if (fiber === undefined) {
					throw new Error("Start a run before interrupting it");
				}
				yield* Fiber.interrupt(fiber);
			}),
		startRun: () =>
			Effect.gen(function* () {
				suite.pendingRun.fiber = yield* runProgram(suite, []).pipe(Effect.forkScoped);
				yield* Deferred.await(suite.attemptPending);
			}),
	};
}
