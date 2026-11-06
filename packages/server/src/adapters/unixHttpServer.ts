import { createServer } from "node:http";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { Duration, Effect, FileSystem, Path, Scope } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { socketState } from "#adapters/socketState.ts";
import { UnixSocketRequest } from "#UnixSocketRequest.ts";

export const unixHttpServer = Effect.fn("Server.unixHttpServer")(function* (path: string, options: NodeHttpServer.Options) {
	const fs = yield* FileSystem.FileSystem;
	const paths = yield* Path.Path;
	const root = paths.dirname(path);
	const scope = yield* Scope.Scope;
	function occupied() {
		return new Error(`A listener is already running at ${path}. Stop it before starting another.`);
	}
	return yield* Effect.scoped(
		Effect.gen(function* () {
			const lock = paths.join(root, `.${paths.basename(path)}.starting`);
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
				if ((yield* fs.stat(path)).type !== "Socket") {
					return yield* Effect.fail(new Error(`The Unix socket path is not a socket: ${path}`));
				}
				yield* fs.remove(path, { force: true });
			}
			// Short private names preserve owner-only access within the public pathname budget.
			const staging = yield* fs.makeTempDirectoryScoped({ directory: root, prefix: ".s" });
			const pending = paths.join(staging, "s");
			const node = createServer();
			const server = yield* NodeHttpServer.make(() => node, {
				...options,
				path: pending,
			}).pipe(Scope.provide(scope));
			yield* fs.chmod(pending, 0o600);
			// Unpublish before Node closes its private bind path.
			yield* Effect.acquireRelease(fs.rename(pending, path), () => fs.remove(path, { force: true }).pipe(Effect.orDie)).pipe(Scope.provide(scope));
			const published = { ...server, address: NetAddress.unixPathAddress(path) };
			function beginCloseTimeout() {
				const deadline = setTimeout(
					() => node.closeAllConnections(),
					Duration.toMillis(Duration.fromInputUnsafe(options.gracefulShutdownTimeout ?? "20 seconds")),
				);
				node.once("close", () => clearTimeout(deadline));
			}
			return HttpServer.make({
				address: published.address,
				serve: (handler, middleware) =>
					Effect.gen(function* () {
						const unix = handler.pipe(Effect.provideService(UnixSocketRequest, true));
						yield* middleware === undefined ? published.serve(unix) : published.serve(unix, middleware);
						yield* Effect.addFinalizer(() => Effect.sync(beginCloseTimeout));
					}),
			});
		}),
	);
});
