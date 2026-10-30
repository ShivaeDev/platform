import { Effect, Exit, Scope } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import * as TestClock from "effect/testing/TestClock";
import { type FakeHttpRequest, fakeHttpService } from "#fakeHttpService.ts";
import { storyKit } from "#storyKit.ts";
import { httpClient, listensForHangUps } from "./httpClient.ts";

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
			const hangUps = yield* listensForHangUps(service.url);
			const chunkReleases: (() => void)[] = [];
			yield* Effect.addFinalizer(() =>
				Effect.sync(() => {
					for (const release of chunkReleases) {
						release();
					}
				}),
			);
			return { chunkReleases, hangUps, scope, service };
		},
		inspect: ({ service }) => service.requests.map(({ method, path, status }) => `${method} ${path} ${status}`),
		name: "HTTP fault controls",
		stages: ["ready"],
		verbs: ({ chunkReleases, hangUps, scope, service }, story) => {
			service.narrate(story.tell);
			return {
				...httpClient(
					() => service.url,
					story.tell,
					() => ({}),
					hangUps,
				),
				closesService: () => {
					story.tell("the fake HTTP service's scope closes");
					return Scope.close(scope, Exit.void);
				},
				failOnce: service.failOnce,
				fault: service.fault,
				hold: service.hold,
				releaseOnArrival: service.releaseOnArrival,
				replyOnce: service.replyOnce,
				requests: () => Effect.sync(() => service.requests.map(({ method, path, status }) => `${method} ${path} ${status}`)),
				scriptFault: service.scriptFault,
				sendsNextChunk: () =>
					Effect.sync(() => {
						const release = chunkReleases.shift();
						if (!release) {
							throw new Error("No scripted HTTP chunk remains to send.");
						}
						story.tell("the reply's next chunk becomes available");
						release();
					}),
				stall: service.stall,
				streamsChunks: (pieces: readonly (string | Uint8Array)[]) => {
					const gates = pieces.map(() => Promise.withResolvers<void>());
					chunkReleases.push(...gates.map((gate) => () => gate.resolve()));
					return service.replyOnce("data", {
						chunks: replyChunks(pieces, gates),
						headers: { "content-type": "application/octet-stream" },
					});
				},
				timePasses: (millis: number) => {
					story.tell(`${millis / 1000} seconds pass`);
					return TestClock.adjust(millis);
				},
			};
		},
	});
}

export const httpFaultApp = httpFaultKit("live");
export const timedHttpApp = httpFaultKit("test");

export function notReadyForFault(kind: string) {
	return `died: Fake HTTP route "data" has no request ready for a ${kind} fault.\nhelp: Wait for a hold before a status or drop fault, or for response headers before a reset fault.`;
}

export function rateLimited(incoming: FakeHttpRequest, now: number) {
	return {
		body: { value: incoming.query.get("value") },
		headers: { "x-ratelimit-reset": String(now + 60_000) },
		status: HttpStatus.fromLiteral("TooManyRequests"),
	};
}
