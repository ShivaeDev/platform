import { Effect } from "effect";
import { HttpIncomingMessage, HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { MAX_BYTES } from "#server/history/limits.ts";
import { HEADERS } from "./respond.ts";

export const RPC_PATH = "/_board/rpc";

export const rpcPolicy = HttpRouter.middleware(
	(http) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			return yield* request.url.split("?")[0] === RPC_PATH
				? http.pipe(
						Effect.provideService(HttpIncomingMessage.MaxBodySize, BigInt(4 * MAX_BYTES + 4096)),
						Effect.map((response) => HttpServerResponse.setHeaders(response, HEADERS)),
					)
				: http;
		}),
	{ global: true },
);
