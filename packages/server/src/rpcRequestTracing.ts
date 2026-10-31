import { Effect, Layer } from "effect";
import { RequestTracing } from "@shivaedev/identity/middleware.ts";
import { requestTracingLayer } from "@shivaedev/identity/server/tracing.ts";
import { type HostRedactionPolicy, redactionForRpc } from "#RedactionPolicy.ts";

export function rpcRequestTracing(sensitive: HostRedactionPolicy) {
	return Layer.succeed(RequestTracing, (effect, request) =>
		RequestTracing.use((tracing) => tracing(effect, request)).pipe(
			Effect.provide(requestTracingLayer({ sensitive: redactionForRpc(sensitive, request.rpc._tag) })),
		),
	);
}
