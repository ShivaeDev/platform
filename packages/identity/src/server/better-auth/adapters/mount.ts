import type { BetterAuthOptions } from "better-auth";
import { Effect, Layer, type Scope } from "effect";
import type { RoleSet } from "@shivaedev/access/roleSet.ts";
import type { Store } from "@shivaedev/rate-limit/Store.ts";
import { accountPreferencesStore } from "#server/account-preferences/store.ts";
import { accountPreferenceOptions } from "#server/better-auth/adapters/accountPreferenceOptions.ts";
import type { AccountRoleSeed } from "#server/better-auth/adapters/accountRoleSeed.ts";
import { acquireAuth } from "#server/better-auth/adapters/acquire.ts";
import { type BearerSessionsOptions, withBearerSessions } from "#server/better-auth/adapters/bearerSessions.ts";
import { closeRoleEndpoints } from "#server/better-auth/adapters/closeRoleEndpoints.ts";
import { effectHookOptions } from "#server/better-auth/adapters/effectHookOptions.ts";
import { emailOptions } from "#server/better-auth/adapters/emailOptions.ts";
import { type BetterAuthHardeningOptions, withHardening } from "#server/better-auth/adapters/hardening.ts";
import { hookRuntime } from "#server/better-auth/adapters/hookRuntime.ts";
import { mountedSessions } from "#server/better-auth/adapters/mountedSessions.ts";
import { mountSettings } from "#server/better-auth/adapters/mountSettings.ts";
import { passwordResetOptions } from "#server/better-auth/adapters/passwordResetOptions.ts";
import { providerOnlyOptions } from "#server/better-auth/adapters/providerOnlyOptions.ts";
import { rateLimitStorage } from "#server/better-auth/adapters/rateLimitStorage.ts";
import { roleSeedOptions } from "#server/better-auth/adapters/roleSeedOptions.ts";
import { authRouteHandler } from "#server/better-auth/adapters/routeHandler.ts";
import { signInPolicyOptions } from "#server/better-auth/adapters/signInPolicyOptions.ts";
import { type StoredRoleOptions, storedRoleOptions } from "#server/better-auth/adapters/storedRoleOptions.ts";
import { admittedSessions } from "#server/better-auth/admittedSessions.ts";
import type { BetterAuthDatabaseHooks } from "#server/better-auth/databaseHooks.ts";
import type { BetterAuthEmails } from "#server/better-auth/emails.ts";
import { AuthRouteHandler, mountRoutes } from "#server/better-auth/mountRoutes.ts";
import type { BetterAuthPasswordReset } from "#server/better-auth/PasswordReset.ts";
import { revokeUnadmitted } from "#server/better-auth/revokeUnadmitted.ts";
import { fromStorage, type PolicyStorage, type SignInPolicy, signInGate } from "#server/better-auth/signInGate.ts";
import { UndeclaredDefaultRole } from "#server/better-auth/UndeclaredDefaultRole.ts";
import { providerFailure } from "#server/providerFailure.ts";

export type BetterAuthMountOptions<E = never, R = never> = {
	readonly accountPreferences?: boolean;
	readonly bearerSessions?: BearerSessionsOptions | undefined;
	readonly clientIp?: "railway";
	readonly databaseHooks?: BetterAuthDatabaseHooks<R> | undefined;
	readonly emails?: BetterAuthEmails<R> | undefined;
	readonly enabledPaths?: readonly string[];
	readonly hardening?: BetterAuthHardeningOptions;
	readonly onPasswordReset?: BetterAuthPasswordReset<R> | undefined;
	readonly preset?: "provider-only";
	readonly signIn?: SignInPolicy<E, R> | undefined;
} & (
	| { readonly roles?: undefined; readonly roleSeed?: undefined }
	| (StoredRoleOptions & { readonly roles: RoleSet; readonly roleSeed?: Effect.Effect<AccountRoleSeed<E>, E, R> })
);

const mountAuth = Effect.fn("Identity.mountAuth")(function* <const TOptions extends BetterAuthOptions, E = never, R = never>(
	options: TOptions,
	mount: BetterAuthMountOptions<E, R> = {},
) {
	if (mount.roles !== undefined) {
		yield* mount.roles.resolve(mount.defaultRole).pipe(Effect.mapError(() => new UndeclaredDefaultRole({ role: mount.defaultRole })));
	}
	const { authOptions, clientIpHeader, rateLimitEnabled, trustedProxy } = yield* mountSettings(options, mount.clientIp);
	const policy = mount.signIn ?? {};
	if (policy.accounts !== undefined) {
		yield* policy.accounts;
	}
	const gate = yield* signInGate(policy);
	const runtime = yield* hookRuntime<R>();
	const preferences =
		mount.accountPreferences === true ? yield* accountPreferenceOptions(options).pipe(Effect.provide(accountPreferencesStore)) : options;
	const reset = passwordResetOptions(preferences, mount.onPasswordReset, runtime);
	const hooked = effectHookOptions(yield* emailOptions(reset, mount.emails, runtime), mount.databaseHooks, runtime);
	const configured = mount.roles === undefined ? hooked : storedRoleOptions(closeRoleEndpoints(hooked), mount);
	const gated = yield* signInPolicyOptions(configured, gate, (): Promise<PolicyStorage> => auth.$context);
	const seed = mount.roleSeed === undefined ? undefined : yield* mount.roleSeed;
	const seeded = roleSeedOptions(gate.active ? { ...configured, ...gated } : configured, seed);
	const base = { ...configured, databaseHooks: seeded.databaseHooks };
	const preset = mount.preset === "provider-only" ? providerOnlyOptions(base, mount.enabledPaths) : base;
	const rateLimit = options.rateLimit;
	const prefix = `/${(options.basePath || "/api/auth").replace(/^\/|\/+$/gu, "")}` as const;
	const basePath = prefix === "/" ? "" : prefix;
	const customStorage = yield* rateLimitStorage;
	const { auth, profiles } = yield* acquireAuth({
		...withHardening(withBearerSessions(preset, mount.bearerSessions !== undefined), mount.hardening),
		...authOptions,
		rateLimit: {
			...rateLimit,
			customStorage,
			enabled: rateLimitEnabled,
		},
		user: gate.active ? gated.user : configured.user,
	});
	const authRoutes = mountRoutes.pipe(
		Layer.provide(
			Layer.succeed(AuthRouteHandler, {
				basePath,
				handle: authRouteHandler(auth, {
					basePath,
					bearerSessions: mount.bearerSessions,
					clientIpHeader,
					ipv6Subnet: options.advanced?.ipAddress?.ipv6Subnet,
					roles: mount.roles,
					runRequest: runtime.runRequest,
					trustedProxy,
				}),
			}),
		),
	);
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
	return { admitsUser, admittedSessions: admit, auth, profiles, revokeUnadmitted: revoke, routes: authRoutes, sessions };
});

type Mounted<TOptions extends BetterAuthOptions, E, R> = ReturnType<typeof mountAuth<TOptions, E, R>>;

export function betterAuthMount<const TOptions extends BetterAuthOptions, E = never, R = never>(
	options: TOptions,
	mount?: BetterAuthMountOptions<E, R> & { readonly emails?: undefined },
): Effect.Effect<Effect.Success<Mounted<TOptions, E, R>>, Effect.Error<Mounted<TOptions, E, R>>, R | Scope.Scope | Store>;
export function betterAuthMount<const TOptions extends BetterAuthOptions, E = never, R = never>(
	options: TOptions,
	mount: BetterAuthMountOptions<E, R>,
): Mounted<TOptions, E, R>;
export function betterAuthMount<const TOptions extends BetterAuthOptions, E = never, R = never>(
	options: TOptions,
	mount: BetterAuthMountOptions<E, R> = {},
) {
	return mountAuth(options, mount);
}
