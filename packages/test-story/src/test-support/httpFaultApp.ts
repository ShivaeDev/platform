import { type Duration, Effect, Exit, Scope } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import * as TestClock from "effect/testing/TestClock";
import { type FakeHttpRequest, fakeHttpService } from "#server/fakeHttpService.ts";
import { storyKit } from "#server/storyKit.ts";
import { drivenClock } from "#test/drivenClock.ts";
import { httpClient } from "#test/httpClient.ts";

async function* replyChunks(pieces: readonly (string | Uint8Array)[], gates: readonly { promise: Promise<void> }[]) {
	for (const [index, piece] of pieces.entries()) {
		await gates[index]?.promise;
		yield piece;
	}
}

export const httpFaultApp = storyKit({
	clock: "test",
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
		return { chunkReleases, clock: yield* drivenClock, scope, service };
	},
	inspect: ({ service }) => service.requests.map(({ method, path, status }) => `${method} ${path} ${status}`),
	name: "HTTP fault controls",
	stages: ["ready"],
	verbs: ({ clock, chunkReleases, scope, service }, story) => {
		service.narrate(story.tell);
		return {
			...httpClient(
				() => service.url,
				story.tell,
				() => ({}),
				(path) => service.untilAbandoned((request) => request.path === path, { name: `abandoned ${path}` }),
			),
			closesService: () => {
				story.tell("the fake HTTP service's scope closes");
				return Scope.close(scope, Exit.void);
			},
			fault: service.fault,
			hold: service.hold,
			releaseOnArrival: service.releaseOnArrival,
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
				return service.scriptFault("data", {
					kind: "status",
					reply: {
						chunks: replyChunks(pieces, gates),
						headers: { "content-type": "application/octet-stream" },
					},
				});
			},
			timePasses: (millis: number) => {
				story.tell(`${millis / 1000} seconds pass`);
				return TestClock.adjust(millis);
			},
			waitsForAbandoned: (path: string, timeout?: Duration.Input) => {
				const wait = service.untilAbandoned((request) => request.path === path, { name: `abandoned ${path}`, timeout: timeout ?? "5 seconds" });
				return timeout === undefined ? clock.run(wait) : clock.drive(wait);
			},
		};
	},
});

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
