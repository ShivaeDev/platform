import { createServer } from "node:http";
import { Deferred, Effect, Fiber } from "effect";
import { loopbackServer } from "@shivaedev/test-story/server/adapters/loopback.ts";
import { perAttempt } from "#test/specFiles.ts";
import { runProgram, type Suite, writeFile } from "#test/suite.ts";

export const holdRerun = Effect.fn("VitestRerunSuite.holdRerun")(function* (suite: Suite) {
	const url = yield* loopbackServer(
		createServer((_request, response) => {
			response.end();
			Effect.runSync(Deferred.succeed(suite.attemptPending, undefined));
		}),
	);
	writeFile(
		suite,
		"pending.spec.ts",
		perAttempt(`
it('waits in its rerun', async () => {
	if (attempt === 1) {
		throw new Error('The first attempt fails');
	}
	await fetch('${url}');
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
