import { Effect, Exit, Scope } from "effect";
import { fakeHttpService } from "#fakeHttpService.ts";
import { storyKit } from "#storyKit.ts";
import { httpProbe } from "#test/httpProbe.ts";

export const httpFaultApp = storyKit({
	clock: "live",
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
			close: () => Scope.close(scope, Exit.void),
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
					chunks: (async function* () {
						for (const [index, piece] of pieces.entries()) {
							await gates[index]?.promise;
							yield piece;
						}
					})(),
					headers: { "content-type": "application/octet-stream" },
				});
			},
		};
	},
});
