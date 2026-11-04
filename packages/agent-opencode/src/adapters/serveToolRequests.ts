import { createServer } from "node:http";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Effect, type Scope } from "effect";
import { HttpServer, HttpServerRequest, HttpServerResponse } from "effect/http";
import type { BackendUnavailable } from "@shivaedev/agent/failures.ts";
import { unavailable } from "#failure.ts";

const LOOPBACK = "127.0.0.1";
const onlyPosted = HttpServerResponse.empty({ headers: { allow: "POST" }, status: 405 });
export function serveToolRequests(answer: (request: Request) => Promise<Response>): Effect.Effect<string, BackendUnavailable, Scope.Scope> {
	return Effect.gen(function* () {
		const server = yield* NodeHttpServer.make(createServer, { host: LOOPBACK, port: 0 });
		const respond = Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			if (request.method !== "POST") {
				return onlyPosted;
			}
			const web = yield* HttpServerRequest.toWeb(request);
			return HttpServerResponse.fromWeb(yield* Effect.promise(() => answer(web)));
		});
		yield* server.serve(respond);
		return HttpServer.formatAddress(server.address);
	}).pipe(Effect.mapError(unavailable));
}
