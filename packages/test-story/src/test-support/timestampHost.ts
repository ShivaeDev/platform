import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Clock, DateTime, Deferred, Effect, Queue, Scope } from "effect";
import { HttpEffect, HttpServerRequest, HttpServerResponse } from "effect/http";
import { domHost } from "#test/domHost.ts";

export const timestampHost = Effect.gen(function* () {
	const directory = yield* Effect.acquireRelease(
		Effect.promise(() => mkdtemp(join(tmpdir(), "story-clock-"))),
		(directoryPath) => Effect.promise(() => rm(directoryPath, { recursive: true })),
	);
	const path = join(directory, "timestamp");
	yield* Effect.promise(() => writeFile(path, ""));
	const createdAt = yield* Clock.currentTimeMillis;
	const jobs = yield* Queue.make<Deferred.Deferred<void, unknown>>();
	const scope = yield* Scope.Scope;
	yield* Effect.gen(function* () {
		const completion = yield* Queue.take(jobs);
		const result = yield* Effect.exit(
			Effect.gen(function* () {
				const now = yield* DateTime.now;
				yield* Effect.tryPromise(() => writeFile(path, DateTime.formatIso(now)));
			}),
		);
		yield* Deferred.done(completion, result);
	}).pipe(Effect.forever, Effect.forkIn(scope));
	const context = yield* Effect.context<never>();
	const handler = HttpEffect.toWebHandlerWith<never, HttpServerRequest.HttpServerRequest>(context)(
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			if (request.method === "POST") {
				const completion = yield* Deferred.make<void, unknown>();
				yield* Queue.offer(jobs, completion);
				yield* Deferred.await(completion);
			}
			const hostAt = DateTime.formatIso(yield* DateTime.now);
			const workerAt = yield* Effect.promise(() => readFile(path, "utf8"));
			return HttpServerResponse.jsonUnsafe({ createdAt, hostAt, workerAt });
		}).pipe(Effect.orDie),
	);
	const url = yield* domHost((request, response) => {
		void handler(new Request("http://clock.test/", { method: request.method ?? "GET" }))
			.then(async (reply) => {
				response.writeHead(reply.status, Object.fromEntries(reply.headers));
				response.end(await reply.text());
			})
			.catch((error: unknown) => response.destroy(error instanceof Error ? error : new Error(String(error))));
	});
	return { url };
});
