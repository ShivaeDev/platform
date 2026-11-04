import type { Schema } from "effect";
import type { Rpc, RpcSchema } from "effect/rpc";
import type { QueryServices } from "#contract.ts";
import type { OperationShape, QueryShape, StreamShape } from "#operation.ts";
import type { ReadPolicyGuard } from "#ReadPolicyGuard.ts";
import type { QueryReadDenied } from "#readPolicyErrors.ts";

export type Tag<TContract extends string, TName extends string> = `${TContract}.${TName}`;

type OperationError<TOperation extends OperationShape> = TOperation extends QueryShape
	? Schema.Union<readonly [TOperation["error"], typeof QueryReadDenied]>
	: TOperation["error"];

export type OperationRpc<TContract extends string, TOperation> = TOperation extends OperationShape
	? TOperation extends StreamShape
		? Rpc.Rpc<Tag<TContract, TOperation["name"]>, TOperation["payload"], RpcSchema.Stream<TOperation["success"], TOperation["error"]>, Schema.Never>
		: Rpc.Rpc<
				Tag<TContract, TOperation["name"]>,
				TOperation["payload"],
				TOperation["success"],
				OperationError<TOperation>,
				TOperation extends QueryShape ? typeof ReadPolicyGuard : never,
				QueryServices<TOperation>
			>
	: never;
