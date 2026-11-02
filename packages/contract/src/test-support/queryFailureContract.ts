import { Effect, Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { contract } from "#contract.ts";
import { query } from "#operation.ts";

export class ClientOffline extends Schema.TaggedError<ClientOffline>()("ClientOffline", {}) {}
export class AccessDenied extends Schema.TaggedError<AccessDenied>()("AccessDenied", {}) {}
export class NoteMissing extends Schema.TaggedError<NoteMissing>()("NoteMissing", {}) {}
export class ListUnavailable extends Schema.TaggedError<ListUnavailable>()("ListUnavailable", {}) {}
export class Guard extends RpcMiddleware.Service<Guard, { clientError: ClientOffline }>()("test/QueryFailureGuard", {
	error: AccessDenied,
}) {}

const definition = { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String };
export const Records = contract("query-failures", {
	queries: [query("get", { ...definition, rejections: { NoteMissing } }), query("list", { ...definition, rejections: { ListUnavailable } })],
}).middleware(Guard);
