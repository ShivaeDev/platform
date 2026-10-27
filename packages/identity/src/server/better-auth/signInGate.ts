import { Cache, type Config, Duration, Effect, Exit } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import type { ProviderAccountValue } from "#identity.ts";

export interface SignInPolicy<E = never, R = never> {
	readonly accounts?: Config.Config<readonly ProviderAccountValue[]> | undefined;
	readonly recheckInterval?: Duration.Input | undefined;
	readonly rule?: ((account: ProviderAccountValue) => Effect.Effect<boolean, E, R>) | undefined;
}

export interface PolicyStorage {
	readonly adapter: {
		readonly count: (query: { readonly model: string; readonly where: Array<{ readonly field: string; readonly value: string }> }) => Promise<number>;
	};
	readonly internalAdapter: {
		readonly deleteUserSessions: (userId: string) => Promise<void>;
		readonly findAccounts: (userId: string) => Promise<readonly ProviderAccountValue[]>;
		readonly listUsers: (
			limit: number,
			offset: number,
			sortBy: { readonly direction: "asc" | "desc"; readonly field: string },
		) => Promise<readonly { readonly id: string }[]>;
	};
}

export interface SignInGate<E> {
	readonly active: boolean;
	readonly admits: (candidates: readonly ProviderAccountValue[]) => Effect.Effect<boolean, E | Config.ConfigError>;
	readonly admitsUser: (storage: PolicyStorage, userId: string) => Effect.Effect<boolean, E | Config.ConfigError | AuthUnavailable>;
}

const RULE_CACHE_CAPACITY = 10_000;

export function fromStorage<A>(read: () => Promise<A>) {
	return Effect.tryPromise(read).pipe(
		Effect.catch((error) =>
			Effect.andThen(
				Effect.logError("Sign-in policy storage failed", redact(error.cause)),
				Effect.fail(new AuthUnavailable({ message: "Authentication is temporarily unavailable" })),
			),
		),
	);
}

function sameAccount(left: ProviderAccountValue, right: ProviderAccountValue) {
	return left.providerId === right.providerId && left.accountId === right.accountId;
}

export const signInGate = Effect.fnUntraced(function* <E, R>(policy: SignInPolicy<E, R>): Effect.fn.Return<SignInGate<E>, never, R> {
	const { accounts, rule } = policy;
	const recheckInterval = Duration.fromInputUnsafe(policy.recheckInterval ?? "5 minutes");
	const verdicts =
		rule === undefined
			? undefined
			: yield* Cache.makeWith(rule, {
					capacity: RULE_CACHE_CAPACITY,
					timeToLive: (exit) => (Exit.isSuccess(exit) ? recheckInterval : Duration.zero),
				});
	const admits = Effect.fnUntraced(function* (candidates: readonly ProviderAccountValue[]) {
		const allowed = accounts === undefined ? undefined : yield* accounts;
		const listed = allowed === undefined ? candidates : candidates.filter((candidate) => allowed.some((entry) => sameAccount(entry, candidate)));
		if (verdicts === undefined) {
			return listed.length > 0;
		}
		for (const { accountId, providerId } of listed) {
			if (yield* Cache.get(verdicts, { accountId, providerId })) {
				return true;
			}
		}
		return false;
	});
	const admitsUser = Effect.fnUntraced(function* (storage: PolicyStorage, userId: string) {
		return yield* admits(yield* fromStorage(() => storage.internalAdapter.findAccounts(userId)));
	});
	return { active: accounts !== undefined || rule !== undefined, admits, admitsUser };
});
