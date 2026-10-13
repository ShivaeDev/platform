import { Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { HEADERS } from "./respond.ts";

export const RPC_PATH = "/_board/rpc";

export const rpcPolicy = HttpRouter.middleware(
	(http) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			return yield* request.url.split("?")[0] === RPC_PATH
				? http.pipe(Effect.map((response) => HttpServerResponse.setHeaders(response, HEADERS)))
				: http;
		}),
	{ global: true },
);
