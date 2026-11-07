import { Cache, type Duration, Effect, Exit, Schema } from "effect";
import { HttpClient, UrlParams } from "effect/http";
import { readBoundedJson } from "#body.ts";
import { InvalidBodyLimit, isRemoteStatusError, ResponseBodyTooLarge } from "#errors.ts";
import { filterStatus } from "#filterStatus.ts";

export class ReadClientError extends Schema.TaggedError<ReadClientError>()("ReadClientError", {
	reason: Schema.Literals(["timeout", "body-too-large", "status", "decode", "transport", "invalid-limit"]),
	source: Schema.String,
	status: Schema.optionalKey(Schema.Number),
}) {}

export interface ReadClientOptions<TSchema extends Schema.Constraint> {
	readonly bodyLimit: number;
	readonly capacity: number;
	readonly schema: TSchema;
	readonly source: string;
	readonly timeout: Duration.Input;
	readonly timeToLive: Duration.Input;
}

export const makeReadClient = Effect.fnUntraced(function* <TSchema extends Schema.Constraint>(options: ReadClientOptions<TSchema>) {
	const client = filterStatus(yield* HttpClient.HttpClient);
	function lookup(url: string) {
		return Effect.gen(function* () {
			const parsed = URL.parse(url);
			yield* Effect.logDebug("Outside API request").pipe(
				Effect.annotateLogs({ method: "GET", source: options.source, url: parsed === null ? "<invalid>" : `${parsed.origin}${parsed.pathname}` }),
			);
			const response = yield* client.get(url);
			return yield* readBoundedJson(response, options.bodyLimit, options.schema);
		}).pipe(
			Effect.mapError((error) => {
				if (isRemoteStatusError(error)) {
					return new ReadClientError({ reason: "status", source: options.source, status: error.status });
				}
				let reason: ReadClientError["reason"] = "transport";
				if (error instanceof ResponseBodyTooLarge) {
					reason = "body-too-large";
				} else if (error instanceof InvalidBodyLimit) {
					reason = "invalid-limit";
				} else if (error instanceof Schema.SchemaError) {
					reason = "decode";
				}
				return new ReadClientError({ reason, source: options.source });
			}),
			Effect.timeoutOrElse({
				duration: options.timeout,
				orElse: () => Effect.fail(new ReadClientError({ reason: "timeout", source: options.source })),
			}),
			Effect.provideService(UrlParams.CurrentRedactedNames, [/.*/u]),
		);
	}
	const cache = yield* Cache.makeWith(lookup, {
		capacity: options.capacity,
		timeToLive: (exit) => (Exit.isSuccess(exit) ? options.timeToLive : 0),
	});
	return { get: (url: string) => Cache.get(cache, url) };
});
