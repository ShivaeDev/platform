import { Effect } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/http";
import { encodeResponse } from "./encoding.ts";
import { HEADERS } from "./respond.ts";

export const RPC_PATH = "/_board/rpc";

export const rpcPolicy = HttpRouter.middleware(
	(http) =>
		Effect.gen(function* () {
			const request = yield* HttpServerRequest.HttpServerRequest;
			return yield* new URL(request.url, "http://127.0.0.1").pathname.replace(/\/$/u, "") === RPC_PATH
				? http.pipe(Effect.flatMap((response) => encodeResponse(request, HttpServerResponse.setHeaders(response, HEADERS))))
				: http;
		}),
	{ global: true },
);

export const MAX_BYTES = 2 * 1024 * 1024;
