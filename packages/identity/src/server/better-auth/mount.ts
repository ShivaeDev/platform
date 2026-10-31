import { type BetterAuthOptions, betterAuth } from "better-auth";
import { Config, Effect, Option, Redacted } from "effect";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { type BetterAuthHardeningOptions, withHardening } from "#server/better-auth/adapters/hardening.ts";
import { signInPolicyOptions } from "#server/better-auth/adapters/signInPolicyOptions.ts";
import { type BearerSessionsOptions, withBearerSessions } from "#server/better-auth/bearerSessions.ts";
import { PEER_IP_HEADER } from "#server/better-auth/clientIp.ts";
import { memoryRateLimit } from "#server/better-auth/memoryRateLimit.ts";
import { mountRoutes } from "#server/better-auth/mountRoutes.ts";
import { revokeUnadmitted } from "#server/better-auth/revokeUnadmitted.ts";
import { type PolicyStorage, type SignInPolicy, signInGate } from "#server/better-auth/signInGate.ts";
import { admittedSessions } from "./admittedSessions.ts";
import { closeRoleEndpoints } from "./closeRoleEndpoints.ts";
import { mountedSessions } from "./mountedSessions.ts";

export interface BetterAuthMountOptions<E = never, R = never> {
	readonly bearerSessions?: BearerSessionsOptions | undefined;
	readonly hardening?: BetterAuthHardeningOptions;
	readonly roles?: RoleSet;
	readonly signIn?: SignInPolicy<E, R> | undefined;
}

export const betterAuthMount = Effect.fn("Platform.betterAuthMount")(function* <const TOptions extends BetterAuthOptions, E = never, R = never>(
	options: TOptions,
	mount: BetterAuthMountOptions<E, R> = {},
) {
	const secret = options.secret ?? Redacted.value(yield* Config.Redacted("BETTER_AUTH_SECRET"));
	const publicUrl = yield* Config.URL("PUBLIC_URL").pipe(Config.option);
	const origin = Option.map(publicUrl, (url) => url.origin);
	const trustedProxy = Option.getOrUndefined(yield* Config.String("TRUSTED_PROXY").pipe(Config.option));
	const clientIpHeader = yield* Config.String("AUTH_CLIENT_IP_HEADER").pipe(Config.withDefault("x-forwarded-for"));
	const rateLimitEnabled = yield* Config.Boolean("AUTH_RATE_LIMIT_ENABLED").pipe(Config.withDefault(true));
	const policy = mount.signIn ?? {};
	if (policy.accounts !== undefined) {
		yield* policy.accounts;
	}
	const gate = yield* signInGate(policy);
	const gated = yield* signInPolicyOptions(options, gate, (): Promise<PolicyStorage> => auth.$context);
	const rateLimit = options.rateLimit;
	const customStorage =
		rateLimit?.customStorage ?? (rateLimit?.storage === undefined || rateLimit.storage === "memory" ? yield* memoryRateLimit : undefined);
	const configured = mount.roles === undefined ? options : closeRoleEndpoints(options);
	const auth = betterAuth({
		...withHardening(withBearerSessions(configured, mount.bearerSessions !== undefined), mount.hardening),
		advanced: {
			useSecureCookies: Option.isSome(publicUrl) && publicUrl.value.protocol === "https:",
			...options.advanced,
			ipAddress: {
				...options.advanced?.ipAddress,
				ipAddressHeaders: [PEER_IP_HEADER],
				trustedProxies: [],
			},
		},
		"baseURL":
			options.baseURL
			?? Option.getOrElse(origin, () => ({
				allowedHosts: ["127.0.0.1:*", "localhost:*"],
				protocol: "http" as const,
			})),
		databaseHooks: gate.active ? gated.databaseHooks : options.databaseHooks,
		rateLimit: {
			...rateLimit,
			...(customStorage === undefined ? {} : { customStorage }),
			enabled: rateLimitEnabled,
		},
		secret,
		trustedOrigins:
			options.trustedOrigins ?? Option.match(origin, { onNone: () => ["http://127.0.0.1:*", "http://localhost:*"], onSome: (url) => [url] }),
		user: gate.active ? gated.user : options.user,
	});
	const authRoutes = mountRoutes(auth, {
		bearerSessions: mount.bearerSessions,
		clientIpHeader,
		ipv6Subnet: options.advanced?.ipAddress?.ipv6Subnet,
		roles: mount.roles,
		trustedProxy,
	});
	const admit = admittedSessions(gate, () => auth.$context, mount.bearerSessions);
	const revoke = revokeUnadmitted(gate, () => auth.$context);
	const lookupSession: unknown = Reflect.get(auth.api, "getSession");
	const sessions = mountedSessions(lookupSession, admit, mount.roles);
	return { admittedSessions: admit, auth, revokeUnadmitted: revoke, routes: authRoutes, sessions };
});
