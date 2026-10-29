import { Effect, type FileSystem, Layer, type Path, type PlatformError } from "effect";
import type { HttpRouter } from "effect/http";
import type { InternalServerError } from "@shivaedev/errors/taxonomy.ts";
import { AppChanges } from "@shivaedev/server/appHost.ts";
import { hostRpcRoutes } from "@shivaedev/server/hostRpcRoutes.ts";
import { schemaSensitiveKeys } from "@shivaedev/server/schemaSensitiveKeys.ts";
import type { RenderFailed } from "#render/Failed.ts";
import { workRpcs } from "#rpc/contract.ts";
import { boardRuntime } from "#server/boardRuntime.ts";
import type { HomeMissing } from "#server/files/home.ts";
import type { MermaidMissing } from "#server/http/assets.ts";
import { boardRoutes } from "#server/http/boardRoutes.ts";
import { RPC_PATH, rpcPolicy } from "#server/http/rpcPolicy.ts";
import { Highlighter } from "#server/render/Highlighter.ts";

export interface BoardOptions {
	readonly fleetPort?: number | null;
	readonly home?: string | undefined;
	readonly maintainer?: string | undefined;
	readonly responses?: boolean;
	readonly root: string;
}

type BoardError = InternalServerError | HomeMissing | MermaidMissing | PlatformError.PlatformError | RenderFailed;
type BoardServices =
	| FileSystem.FileSystem
	| HttpRouter.HttpRouter
	| Path.Path
	| HttpRouter.Request<"Error", InternalServerError | PlatformError.PlatformError>;

export function boardLayer(options: BoardOptions): Layer.Layer<never, BoardError, BoardServices> {
	return Layer.unwrap(
		Effect.gen(function* () {
			const runtime = yield* boardRuntime(options);
			const rpc = hostRpcRoutes(
				{ group: workRpcs, handlers: runtime.rpcHandlers, policy: "loopback", rpcPath: RPC_PATH },
				AppChanges,
				{ bodySize: 4 * 1024 * 1024, host: "127.0.0.1", nativeOrigins: [], trustedProxy: undefined },
				schemaSensitiveKeys(workRpcs),
			).pipe(Layer.provide(runtime.live));
			return Layer.mergeAll(boardRoutes(options, runtime), rpc, rpcPolicy);
		}),
	).pipe(Layer.provide(Highlighter.layer));
}
