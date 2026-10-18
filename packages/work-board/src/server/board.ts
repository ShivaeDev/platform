import { Effect, type FileSystem, Layer, type Path, type PlatformError } from "effect";
import { HttpRouter } from "effect/http";
import { RpcSerialization, RpcServer } from "effect/rpc";
import type { InternalServerError } from "@shivaedev/platform/errors/taxonomy.ts";
import { localRpcGuard } from "@shivaedev/platform/rpc-server/local.ts";
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
			const rpc = RpcServer.layerHttp({ group: workRpcs, path: RPC_PATH, protocol: "http" }).pipe(
				Layer.provide([
					runtime.rpcHandlers,
					RpcSerialization.layerNdjson,
					HttpRouter.middleware((http) => localRpcGuard(http).pipe(Effect.provideService(RpcSerialization.RpcSerialization, RpcSerialization.ndjson)))
						.layer,
				]),
			);
			return Layer.mergeAll(boardRoutes(options, runtime), rpc, rpcPolicy);
		}),
	).pipe(Layer.provide(Highlighter.layer));
}
