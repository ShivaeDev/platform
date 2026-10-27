import { Config, Effect, Option, Result, Schema } from "effect";
import * as NetAddress from "effect/net/NetAddress";
import { TrustedProxy } from "@shivaedev/identity/server/trustedProxy.ts";
import { NativeOrigins } from "#nativeClientOrigins.ts";

interface Options {
	readonly config?: { readonly host?: string; readonly maxBodySize?: number; readonly trustedProxy?: string };
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
	const host = options.config?.host ?? (yield* Config.String("HOST").pipe(Config.withDefault("127.0.0.1")));
	const loopback =
		host.toLowerCase() === "localhost"
		|| Result.match(NetAddress.ipFromString(host), {
			onFailure: () => false,
			onSuccess: (address) => NetAddress.isLoopback(NetAddress.toCanonical(address)),
		});
	if (options.policy !== "loopback" && !loopback && trustedProxy === undefined) {
		yield* Effect.logWarning(
			"RPC forwarding is refused without a trusted proxy. Set TRUSTED_PROXY or config.trustedProxy for this non-loopback HOST.",
		);
	}
	const nativeOrigins = yield* Schema.decodeUnknownEffect(NativeOrigins)(options.nativeOrigins ?? []).pipe(
		Effect.mapError((cause) => new Config.ConfigError(cause)),
	);
	return { bodySize, host, nativeOrigins, trustedProxy };
});
