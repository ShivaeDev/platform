import { Deferred, Effect, PubSub, type Scope, Stream } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http";
import { type ReadFailure, Rejected } from "@shivaedev/agent/failures.ts";
import { checkStatus } from "@shivaedev/http/checkStatus.ts";
import { filterStatus } from "@shivaedev/http/filterStatus.ts";
import { opencodeFailure, unavailable } from "#failure.ts";
import type { OpencodeRequest } from "#OpencodeRequest.ts";
import { openSseBuffer } from "#openSseBuffer.ts";
import type { ProviderPort } from "#Provider.ts";
import type { ToolSessions } from "#toolSessions.ts";

function checkedPost(response: HttpClientResponse.HttpClientResponse, request: OpencodeRequest) {
	return HttpClientResponse.matchStatus(response, {
		"4xx": (refused) =>
			Effect.fail(
				new Rejected({
					backend: "opencode",
					message: `POST ${request.path} refused with HTTP ${refused.status}`,
					providerCode: String(refused.status),
				}),
			),
		orElse: (answered) => checkStatus(answered).pipe(Effect.as(answered)),
	});
}
export const makeOpencodeServer = Effect.fn("OpenCode.makeOpencodeServer")(function* (
	url: string,
	tools: ToolSessions,
): Effect.fn.Return<ProviderPort, ReadFailure, Scope.Scope | HttpClient.HttpClient> {
	const native = yield* HttpClient.HttpClient;
	const client = filterStatus(native);
	const frames = yield* PubSub.unbounded<unknown>();
	const exited = yield* Deferred.make<void>();
	const ready = yield* Deferred.make<void, ReadFailure>();
	const buffer = openSseBuffer(() => undefined);
	const listen = client.get(new URL("/global/event", url).href).pipe(
		Effect.mapError(unavailable),
		Effect.flatMap((response) =>
			Deferred.succeed(ready, undefined).pipe(
				Effect.andThen(
					response.stream.pipe(
						Stream.decodeText,
						Stream.flatMap((text) => Stream.fromIterable(buffer.take(text))),
						Stream.runForEach((frame) => PubSub.publish(frames, frame)),
					),
				),
			),
		),
		Effect.catch((error) => Deferred.fail(ready, unavailable(error))),
		Effect.ensuring(Deferred.succeed(exited, undefined)),
	);
	yield* Effect.forkScoped(listen);
	yield* Deferred.await(ready);
	function call(method: "GET" | "POST") {
		return (request: OpencodeRequest) => {
			const address = new URL(request.path, url);
			for (const [key, value] of Object.entries(request.query)) {
				address.searchParams.set(key, value);
			}
			const req = HttpClientRequest.make(method)(address.href);
			const send =
				method === "POST"
					? native.execute(HttpClientRequest.bodyJsonUnsafe(req, request.body)).pipe(Effect.flatMap((response) => checkedPost(response, request)))
					: client.execute(req);
			return send.pipe(
				Effect.mapError((error) => (error._tag === "Rejected" ? error : unavailable(error))),
				Effect.flatMap((response) => (response.status === 204 ? Effect.succeed(undefined) : response.json.pipe(Effect.mapError(opencodeFailure)))),
			);
		};
	}
	return {
		exited: Deferred.await(exited),
		frames,
		get: (request) => call("GET")(request).pipe(Effect.catchTag("Rejected", (error) => Effect.fail(opencodeFailure(error.message)))),
		post: call("POST"),
		tools,
	};
});
