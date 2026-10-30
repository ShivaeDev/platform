import { Deferred, Effect, FileSystem, Layer, PlatformError } from "effect";
import { HttpClient, HttpClientError, type HttpClientRequest } from "effect/http";

export type FileOperation = "read" | "write" | "rename";

export interface Gate {
	readonly reached: Deferred.Deferred<void>;
	readonly release: Deferred.Deferred<void>;
}

export const makeGate = Effect.all({ reached: Deferred.make<void>(), release: Deferred.make<void>() });

export function passGate(gate: Gate | undefined) {
	return gate === undefined ? Effect.void : Deferred.succeed(gate.reached, undefined).pipe(Effect.andThen(Deferred.await(gate.release)));
}

function transportFailure(request: HttpClientRequest.HttpClientRequest) {
	return Effect.fail(
		new HttpClientError.HttpClientError({
			reason: new HttpClientError.TransportError({ cause: new Error("Unavailable"), request }),
		}),
	);
}

export const makeIo = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const client = yield* HttpClient.HttpClient;
	const control: {
		changed: () => void;
		failing?: FileOperation;
		rename?: Gate;
		stalled: number;
		transport: "works" | "fails" | "stalls";
	} = { changed: () => undefined, stalled: 0, transport: "works" };
	const stall = Effect.suspend(() => {
		control.stalled += 1;
		control.changed();
		return Effect.never;
	}).pipe(
		Effect.ensuring(
			Effect.sync(() => {
				control.stalled -= 1;
				control.changed();
			}),
		),
	);
	function failure(method: FileOperation) {
		return Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method, module: "FileSystem" }));
	}
	const files = FileSystem.makeNoop({
		...fs,
		readFileString: (path) => Effect.suspend(() => (control.failing === "read" ? failure("read") : fs.readFileString(path))),
		rename: (from, to) =>
			Effect.gen(function* () {
				yield* passGate(control.rename);
				if (control.failing === "rename") {
					return yield* failure("rename");
				}
				yield* fs.rename(from, to);
			}),
		writeFileString: (path, text, options) =>
			Effect.suspend(() => (control.failing === "write" ? failure("write") : fs.writeFileString(path, text, options))),
	});
	const http = HttpClient.transform(client, (effect, request) =>
		Effect.suspend(() => {
			if (control.transport === "stalls") {
				return stall;
			}
			return control.transport === "fails" ? transportFailure(request) : effect;
		}),
	);
	return {
		control,
		fs,
		layer: Layer.mergeAll(Layer.succeed(FileSystem.FileSystem)(files), Layer.succeed(HttpClient.HttpClient)(http)),
	};
});
