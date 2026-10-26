import { Config, Effect, Option, Schema } from "effect";
import { TrustedProxy } from "@shivaedev/identity/server/trustedProxy.ts";
import { NativeOrigins } from "#server/nativeClientOrigins.ts";

interface Options {
	readonly config?: { readonly maxBodySize?: number; readonly trustedProxy?: string };
	readonly nativeOrigins?: readonly string[];
	readonly policy?: "loopback" | undefined;
}
export const hostTransport = Effect.fn("Platform.hostTransport")(function* (options: Options) {
	const maxBodySize = options.config?.maxBodySize ?? (yield* Config.Int("MAX_BODY_SIZE").pipe(Config.withDefault(1024 * 1024)));
	const bodySize = yield* Schema.decodeUnknownEffect(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)))(maxBodySize).pipe(
		Effect.mapError((cause) => new Config.ConfigError(cause)),
	);
	const trustedProxy =
		options.policy === "loopback"
			? undefined
			: (options.config?.trustedProxy ?? Option.getOrUndefined(yield* Config.String("TRUSTED_PROXY").pipe(Config.option)));
	if (trustedProxy !== undefined) {
		yield* Schema.decodeUnknownEffect(TrustedProxy)(trustedProxy).pipe(Effect.mapError((cause) => new Config.ConfigError(cause)));
	}
	const nativeOrigins = yield* Schema.decodeUnknownEffect(NativeOrigins)(options.nativeOrigins ?? []).pipe(
		Effect.mapError((cause) => new Config.ConfigError(cause)),
	);
	return { bodySize, nativeOrigins, trustedProxy };
});
