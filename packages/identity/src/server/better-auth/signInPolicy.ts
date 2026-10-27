import type { BetterAuthOptions, ValidateUserInfoResult, ValidateUserInfoSource } from "better-auth";
import { APIError } from "better-auth/api";
import { Effect, Exit } from "effect";
import { redact } from "@shivaedev/errors/redact.ts";
import { fromStorage, type PolicyStorage, type SignInGate } from "#server/better-auth/signInGate.ts";

type SessionCreateBefore = NonNullable<NonNullable<NonNullable<NonNullable<BetterAuthOptions["databaseHooks"]>["session"]>["create"]>["before"]>;
type ValidateUserInfo = NonNullable<NonNullable<BetterAuthOptions["user"]>["validateUserInfo"]>;
export type PolicyRun = <A, E>(effect: Effect.Effect<A, E>) => Promise<A>;

const REFUSED_MESSAGE = "This account may not sign in";
const UNAVAILABLE_MESSAGE = "Sign-in is temporarily unavailable";
const refused: ValidateUserInfoResult = { error: "sign_in_refused", errorDescription: REFUSED_MESSAGE };
const unavailable: ValidateUserInfoResult = { error: "sign_in_unavailable", errorDescription: UNAVAILABLE_MESSAGE };

function logged<A, E>(effect: Effect.Effect<A, E>) {
	return Effect.tapCause(effect, (cause) => Effect.logError("Sign-in policy check failed", redact(cause)));
}

async function signingInAccount(
	source: ValidateUserInfoSource,
	providers: readonly { readonly accountSubject: (context: { profile: object; tokens: object }) => unknown; readonly id: string }[],
) {
	const profile = source.oauth?.profile;
	const provider = providers.find(({ id }) => id === source.oauth?.providerId);
	if (source.method !== "oauth" || profile === undefined || provider === undefined) {
		return undefined;
	}
	const subject = await provider.accountSubject({ profile, tokens: {} });
	return typeof subject === "string" || typeof subject === "number" ? { accountId: String(subject), providerId: provider.id } : undefined;
}

export function signInPolicyOptions<E>(options: BetterAuthOptions, gate: SignInGate<E>, run: PolicyRun, storage: () => Promise<PolicyStorage>) {
	const sessionBefore = options.databaseHooks?.session?.create?.before;
	const before: SessionCreateBefore = async (session, endpoint) => {
		const own = await sessionBefore?.(session, endpoint);
		if (own === false) {
			return own;
		}
		const userId = typeof own === "object" && typeof own.data.userId === "string" ? own.data.userId : session.userId;
		const exit = await run(Effect.exit(logged(Effect.flatMap(fromStorage(storage), (auth) => gate.admitsUser(auth, userId)))));
		if (Exit.isFailure(exit)) {
			throw new APIError("SERVICE_UNAVAILABLE", { code: unavailable.error, message: UNAVAILABLE_MESSAGE });
		}
		if (!exit.value) {
			throw new APIError("FORBIDDEN", { code: refused.error, message: REFUSED_MESSAGE });
		}
		return own;
	};
	const validateUserInfo: ValidateUserInfo = async (data, endpoint) => {
		const own = await options.user?.validateUserInfo?.(data, endpoint);
		if (own !== undefined || data.source.action !== "create-user") {
			return own;
		}
		const account = await signingInAccount(data.source, endpoint.context.socialProviders).catch(() => undefined);
		if (account === undefined) {
			return refused;
		}
		const exit = await run(Effect.exit(logged(gate.admits([account]))));
		if (Exit.isFailure(exit)) {
			return unavailable;
		}
		return exit.value ? undefined : refused;
	};
	return {
		databaseHooks: {
			...options.databaseHooks,
			session: { ...options.databaseHooks?.session, create: { ...options.databaseHooks?.session?.create, before } },
		},
		user: { ...options.user, validateUserInfo },
	};
}
