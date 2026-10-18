import { Deferred, Effect, FileSystem, Layer, PlatformError } from "effect";
import { HttpClient, HttpClientError, type HttpClientRequest } from "effect/http";

function transportFailure(request: HttpClientRequest.HttpClientRequest) {
	return Effect.fail(
		new HttpClientError.HttpClientError({
			reason: new HttpClientError.TransportError({ cause: new Error("Unavailable"), request }),
		}),
	);
}

export type Operation = "read" | "write" | "rename";
export const makeIo = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const client = yield* HttpClient.HttpClient;
	const reads: string[] = [];
	const replacements: string[] = [];
	const urls: string[] = [];
	const control: {
		failure?: Operation;
		transportFails: boolean;
		replacement?: {
			started: Deferred.Deferred<void>;
			finish: Deferred.Deferred<void>;
		};
	} = { transportFails: false };
	function failure(method: Operation) {
		return Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method, module: "FileSystem" }));
	}
	const recorded = FileSystem.makeNoop({
		...fs,
		readFileString: (path) =>
			Effect.suspend(() => {
				reads.push(path);
				return control.failure === "read" ? failure("read") : fs.readFileString(path);
			}),
		rename: (from, to) =>
			Effect.gen(function* () {
				replacements.push(to);
				if (control.replacement) {
					yield* Deferred.succeed(control.replacement.started, undefined);
					yield* Deferred.await(control.replacement.finish);
				}
				if (control.failure === "rename") {
					return yield* failure("rename");
				}
				yield* fs.rename(from, to);
			}),
		writeFileString: (path, text, options) =>
			Effect.suspend(() => (control.failure === "write" ? failure("write") : fs.writeFileString(path, text, options))),
	});
	const http = HttpClient.transform(
		HttpClient.mapRequest(client, (request) => {
			urls.push(request.url);
			return request;
		}),
		(effect, request) => Effect.suspend(() => (control.transportFails ? transportFailure(request) : effect)),
	);
	return {
		control,
		fs,
		layer: Layer.mergeAll(Layer.succeed(FileSystem.FileSystem)(recorded), Layer.succeed(HttpClient.HttpClient)(http)),
		reads,
		replacements,
		urls,
	};
});
