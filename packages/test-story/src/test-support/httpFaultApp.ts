import { Effect, Exit, Scope } from "effect";
import * as TestClock from "effect/testing/TestClock";
import { eventually } from "@shivaedev/test/eventually.ts";
import { fakeHttpService } from "#fakeHttpService.ts";
import { storyKit } from "#storyKit.ts";
import { httpProbe } from "#test/httpProbe.ts";

async function* replyChunks(pieces: readonly (string | Uint8Array)[], gates: readonly { promise: Promise<void> }[]) {
	for (const [index, piece] of pieces.entries()) {
		await gates[index]?.promise;
		yield piece;
	}
}

function httpFaultKit(clock: "live" | "test") {
	return storyKit({
		clock,
		*create() {
			const scope = yield* Scope.fork(yield* Scope.Scope);
			const service = yield* fakeHttpService({
				guard: ({ headers }) => headers.authorization !== "rejected",
				routes: {
					data: { path: "/data", reply: () => ({ body: { ready: true } }) },
					trigger: { path: "/trigger", reply: () => ({ body: { triggered: true } }) },
				},
			}).pipe(Effect.provideService(Scope.Scope, scope));
			const chunkReleases: (() => void)[] = [];
			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					for (const release of chunkReleases) {
						release();
					}
				}),
			);
			return { chunkReleases, scope, service };
		},
		name: "HTTP fault controls",
		stages: ["ready"],
		verbs: ({ chunkReleases, scope, service }, story) => {
			service.narrate(story.tell);
			return {
				advanceTime: (millis: number) => TestClock.adjust(millis),
				close: () => Scope.close(scope, Exit.void),
				failOnce: service.failOnce,
				fault: service.fault,
				hold: service.hold,
				releaseOnArrival: service.releaseOnArrival,
				replyOnce: service.replyOnce,
				request: (path = "/data") =>
					Effect.acquireRelease(
						Effect.sync(() => httpProbe(`${service.url}${path}`)),
						(client) => client.abort,
					),
				requestRejected: () => Effect.tryPromise(() => fetch(`${service.url}/trigger`, { headers: { authorization: "rejected" } })),
				requests: () => service.requests.map(({ method, path, status }) => `${method} ${path} ${status}`),
				scriptFault: service.scriptFault,
				sendChunk: () =>
					Effect.sync(() => {
						const release = chunkReleases.shift();
						if (!release) {
							throw new Error("No scripted HTTP chunk remains to send.");
						}
						release();
					}),
				stall: service.stall,
				streamChunks: (pieces: readonly (string | Uint8Array)[]) => {
					const gates = pieces.map(() => Promise.withResolvers<void>());
					chunkReleases.push(...gates.map((gate) => () => gate.resolve()));
					return service.replyOnce("data", {
						chunks: replyChunks(pieces, gates),
						headers: { "content-type": "application/octet-stream" },
					});
				},
				waitForDisconnect: () =>
					eventually(
						Effect.suspend(() =>
							service.requests.some(({ status }) => status === "unanswered") ? Effect.void : Effect.fail("No disconnect recorded"),
						),
						{ times: 100 },
					),
			};
		},
	});
}

export const httpFaultApp = httpFaultKit("live");
export const timedHttpApp = httpFaultKit("test");
