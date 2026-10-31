import { Effect, Layer } from "effect";
import {
	HttpPlatform,
	HttpRouter,
	HttpServerError,
	HttpServerRequest,
	HttpServerRespondable,
	HttpServerResponse,
	HttpStaticServer,
} from "effect/http";
import type { AssetOptions } from "#AssetOptions.ts";
import { assetHeaders } from "#assetHeaders.ts";

export function hostAssets(input: string | AssetOptions) {
	const options = typeof input === "string" ? { root: input } : input;
	return Layer.effectDiscard(
		Effect.gen(function* () {
			const router = yield* HttpRouter.HttpRouter;
			const platform = yield* HttpPlatform.HttpPlatform;
			const handler = Effect.gen(function* () {
				const request = yield* HttpServerRequest.HttpServerRequest;
				let file: string | undefined;
				const response = yield* HttpStaticServer.make({ ...options, cacheControl: undefined }).pipe(
					Effect.mapError((cause) => new HttpServerError.HttpServerError({ reason: new HttpServerError.InternalError({ cause, request }) })),
					Effect.flatten,
					Effect.provideService(HttpPlatform.HttpPlatform, {
						...platform,
						fileResponse: (name, settings) => {
							file = name;
							return platform.fileResponse(name, settings);
						},
					}),
				);
				if (file === undefined) {
					return response;
				}
				// Observe the selected file so SPA fallbacks and conditional responses share its policy.
				const pathname = new URL(request.originalUrl, "http://localhost").pathname;
				return HttpServerResponse.setHeaders(response, yield* assetHeaders(options, file, pathname));
			}).pipe(Effect.catch(HttpServerRespondable.toResponse));
			yield* (options.prefix === undefined ? router : router.prefixed(options.prefix)).add("GET", "/*", handler);
		}),
	);
}
