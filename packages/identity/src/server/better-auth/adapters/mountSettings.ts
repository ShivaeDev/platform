import type { BetterAuthOptions } from "better-auth";
import { Config, Effect, Option, Redacted } from "effect";
import { PEER_IP_HEADER } from "#server/better-auth/adapters/clientIp.ts";

export const mountSettings = Effect.fnUntraced(function* (options: BetterAuthOptions) {
	const secret = options.secret ?? Redacted.value(yield* Config.Redacted("BETTER_AUTH_SECRET"));
	const publicUrl = yield* Config.URL("PUBLIC_URL").pipe(Config.option);
	const origin = Option.map(publicUrl, (url) => url.origin);
	const trustedProxy = Option.getOrUndefined(yield* Config.String("TRUSTED_PROXY").pipe(Config.option));
	const clientIpHeader = yield* Config.String("AUTH_CLIENT_IP_HEADER").pipe(Config.withDefault("x-forwarded-for"));
	const rateLimitEnabled = yield* Config.Boolean("AUTH_RATE_LIMIT_ENABLED").pipe(Config.withDefault(true));
	return {
		authOptions: {
			advanced: {
				useSecureCookies: Option.isSome(publicUrl) && publicUrl.value.protocol === "https:",
				...options.advanced,
				ipAddress: { ...options.advanced?.ipAddress, ipAddressHeaders: [PEER_IP_HEADER], trustedProxies: [] },
			},
			"baseURL": options.baseURL ?? Option.getOrElse(origin, () => ({ allowedHosts: ["127.0.0.1:*", "localhost:*"], protocol: "http" as const })),
			secret,
			trustedOrigins:
				options.trustedOrigins ?? Option.match(origin, { onNone: () => ["http://127.0.0.1:*", "http://localhost:*"], onSome: (url) => [url] }),
		} satisfies BetterAuthOptions,
		clientIpHeader,
		rateLimitEnabled,
		trustedProxy,
	};
});
