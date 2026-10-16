import { createServer } from "node:http";
import { createConnection } from "node:net";
import { NodeHttpServer } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { RpcSerialization, RpcServer } from "effect/rpc";
import { workRpcs } from "#rpc/contract.ts";
import { RPC_PATH } from "#server/http/rpcPolicy.ts";
import type { boardRuntime } from "./boardRuntime.ts";

function socketState(path: string) {
	return Effect.callback<"live" | "missing" | "stale", Error>((resume) => {
		const socket = createConnection(path);
		socket.once("connect", () => {
			socket.destroy();
			resume(Effect.succeed("live"));
		});
		socket.once("error", (cause: NodeJS.ErrnoException) => {
			if (cause.code === "ENOENT") {
				resume(Effect.succeed("missing"));
			} else if (cause.code === "ECONNREFUSED") {
				resume(Effect.succeed("stale"));
			} else {
				resume(Effect.fail(cause));
			}
		});
		return Effect.sync(() => socket.destroy());
	});
}

export const boardSocket = Effect.fn("WorkBoard.boardSocket")(function* (
	root: string,
	handlers: Effect.Success<ReturnType<typeof boardRuntime>>["rpcHandlers"],
) {
	const fs = yield* FileSystem.FileSystem;
	const path = (yield* Path.Path).join(root, "board.sock");
	function occupied() {
		return new Error(`Another board is already running at ${path}. Stop it before starting this board.`);
	}
	const state = yield* socketState(path);
	if (state === "live") {
		return yield* Effect.fail(occupied());
	}
	if (state === "stale") {
		yield* fs.remove(path, { force: true });
	}
	let owned = false;
	yield* Effect.addFinalizer(() => (owned ? fs.remove(path, { force: true }).pipe(Effect.orDie) : Effect.void));
	const server = yield* NodeHttpServer.make(createServer, { disablePreemptiveShutdown: true, path }).pipe(
		Effect.mapError((error) => (Reflect.get(error.cause ?? {}, "code") === "EADDRINUSE" ? occupied() : error)),
	);
	owned = true;
	yield* fs.chmod(path, 0o600);
	const context = yield* Layer.build(handlers.pipe(Layer.provideMerge(RpcSerialization.layerNdjson)));
	const rpc = yield* RpcServer.toHttpEffect(workRpcs).pipe(Effect.provideContext(context));
	yield* server.serve(
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			return request.method === "POST" && request.url === RPC_PATH ? yield* rpc : HttpServerResponse.empty({ status: 404 });
		}),
	);
});
