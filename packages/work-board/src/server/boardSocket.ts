import { createServer } from "node:http";
import { createConnection } from "node:net";
import { NodeHttpServer } from "@effect/platform-node";
import { Duration, Effect, FileSystem, Layer, Path, Scope } from "effect";
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
	drainRequests = false,
) {
	const fs = yield* FileSystem.FileSystem;
	const paths = yield* Path.Path;
	const path = paths.join(root, "board.sock");
	const scope = yield* Scope.Scope;
	function occupied() {
		return new Error(`Another board is already running at ${path}. Stop it before starting this board.`);
	}
	const context = yield* Layer.build(handlers.pipe(Layer.provideMerge(RpcSerialization.layerNdjson)));
	const rpc = yield* RpcServer.toHttpEffect(workRpcs).pipe(Effect.provideContext(context));
	yield* Effect.scoped(
		Effect.gen(function* () {
			const lock = paths.join(root, ".board.sock.starting");
			yield* Effect.acquireRelease(
				fs.makeDirectory(lock, { mode: 0o700 }).pipe(
					Effect.catchIf(
						(error) => error.reason._tag === "AlreadyExists",
						() =>
							Effect.fail(new Error(`${occupied().message} A startup lock exists at ${lock}; remove it only if its startup was forcibly killed.`)),
					),
				),
				() => fs.remove(lock, { recursive: true }).pipe(Effect.orDie),
			);
			const state = yield* socketState(path);
			if (state === "live") {
				return yield* Effect.fail(occupied());
			}
			if (state === "stale") {
				yield* fs.remove(path, { force: true });
			}
			// Short private names preserve owner-only access within board.sock's pathname budget.
			const staging = yield* fs.makeTempDirectoryScoped({ directory: root, prefix: ".s" });
			const pending = paths.join(staging, "s");
			const server = yield* NodeHttpServer.make(createServer, {
				disablePreemptiveShutdown: !drainRequests,
				gracefulShutdownTimeout: Duration.infinity,
				path: pending,
			}).pipe(Scope.provide(scope));
			yield* fs.chmod(pending, 0o600);
			yield* server
				.serve(
					Effect.gen(function* () {
						const request = yield* HttpServerRequest.HttpServerRequest;
						return request.method === "POST" && request.url === RPC_PATH ? yield* rpc : HttpServerResponse.empty({ status: 404 });
					}),
				)
				.pipe(Scope.provide(scope));
			// Unpublish while this listener still answers probes, before Node closes its private bind path.
			yield* Effect.acquireRelease(fs.rename(pending, path), () => fs.remove(path, { force: true }).pipe(Effect.orDie)).pipe(Scope.provide(scope));
		}),
	);
});
