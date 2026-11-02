import { type BetterAuthOptions, betterAuth } from "better-auth";
import { Config, Effect, Option, Redacted } from "effect";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import { effectHookOptions } from "#server/better-auth/adapters/effectHookOptions.ts";
import { emailOptions } from "#server/better-auth/adapters/emailOptions.ts";
import { type BetterAuthHardeningOptions, withHardening } from "#server/better-auth/adapters/hardening.ts";
import { hookRuntime } from "#server/better-auth/adapters/hookRuntime.ts";
import { passwordResetOptions } from "#server/better-auth/adapters/passwordResetOptions.ts";
import { rateLimitStorage } from "#server/better-auth/adapters/rateLimitStorage.ts";
import { roleSeedOptions } from "#server/better-auth/adapters/roleSeedOptions.ts";
import { signInPolicyOptions } from "#server/better-auth/adapters/signInPolicyOptions.ts";
import { type StoredRoleOptions, storedRoleOptions } from "#server/better-auth/adapters/storedRoleOptions.ts";
import { type BearerSessionsOptions, withBearerSessions } from "#server/better-auth/bearerSessions.ts";
import { PEER_IP_HEADER } from "#server/better-auth/clientIp.ts";
import { mountRoutes } from "#server/better-auth/mountRoutes.ts";
import { revokeUnadmitted } from "#server/better-auth/revokeUnadmitted.ts";
import { fromStorage, type PolicyStorage, type SignInPolicy, signInGate } from "#server/better-auth/signInGate.ts";
import { providerFailure } from "#server/providerFailure.ts";
import type { AccountRoleSeed } from "./accountRoleSeed.ts";
import { admittedSessions } from "./admittedSessions.ts";
import { closeRoleEndpoints } from "./closeRoleEndpoints.ts";
import type { BetterAuthDatabaseHooks } from "./databaseHooks.ts";
import type { BetterAuthEmails } from "./emails.ts";
import { mountedSessions } from "./mountedSessions.ts";
import type { BetterAuthPasswordReset } from "./PasswordReset.ts";

export type BetterAuthMountOptions<E = never, R = never> = {
	readonly bearerSessions?: BearerSessionsOptions | undefined;
	readonly databaseHooks?: BetterAuthDatabaseHooks<R> | undefined;
	readonly emails?: BetterAuthEmails<R> | undefined;
	readonly hardening?: BetterAuthHardeningOptions;
	readonly onPasswordReset?: BetterAuthPasswordReset<R> | undefined;
	readonly signIn?: SignInPolicy<E, R> | undefined;
} & (
	| { readonly roles?: undefined; readonly roleSeed?: undefined }
	| (StoredRoleOptions & { readonly roles: RoleSet; readonly roleSeed?: Effect.Effect<AccountRoleSeed<E>, E, R> })
);

export const betterAuthMount = Effect.fn("Identity.betterAuthMount")(function* <const TOptions extends BetterAuthOptions, E = never, R = never>(
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
	const runtime = yield* hookRuntime<R>();
	const reset = passwordResetOptions(options, mount.onPasswordReset, runtime);
	const hooked = effectHookOptions(yield* emailOptions(reset, mount.emails, runtime), mount.databaseHooks, runtime);
	const configured = mount.roles === undefined ? hooked : storedRoleOptions(closeRoleEndpoints(hooked), mount);
	const gated = yield* signInPolicyOptions(configured, gate, (): Promise<PolicyStorage> => auth.$context);
	const seed = mount.roleSeed === undefined ? undefined : yield* mount.roleSeed;
	const seeded = roleSeedOptions(gate.active ? { ...configured, ...gated } : configured, seed);
	const rateLimit = options.rateLimit;
	const customStorage = yield* rateLimitStorage;
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
		databaseHooks: seeded.databaseHooks,
		rateLimit: {
			...rateLimit,
			customStorage,
			enabled: rateLimitEnabled,
		},
		secret,
		trustedOrigins:
			options.trustedOrigins ?? Option.match(origin, { onNone: () => ["http://127.0.0.1:*", "http://localhost:*"], onSome: (url) => [url] }),
		user: gate.active ? gated.user : configured.user,
	});
	const authRoutes = mountRoutes(auth, {
		bearerSessions: mount.bearerSessions,
		clientIpHeader,
		ipv6Subnet: options.advanced?.ipAddress?.ipv6Subnet,
		roles: mount.roles,
		runRequest: runtime.runRequest,
		trustedProxy,
	});
	const admit = admittedSessions(gate, () => auth.$context, mount.bearerSessions);
	const admission = yield* signInGate({ ...policy, recheckInterval: 0 });
	const admitsUser = Effect.fn("Identity.admitsUser")(function* (userId: string) {
		if (!admission.active) {
			return true;
		}
		const storage = yield* fromStorage(() => auth.$context);
		return yield* admission.admitsUser(storage, userId).pipe(Effect.catch(providerFailure));
	});
	const revoke = revokeUnadmitted(gate, () => auth.$context);
	const lookupSession: unknown = Reflect.get(auth.api, "getSession");
	const sessions = mountedSessions(lookupSession, admit, mount.roles);
	return { admitsUser, admittedSessions: admit, auth, revokeUnadmitted: revoke, routes: authRoutes, sessions };
});
