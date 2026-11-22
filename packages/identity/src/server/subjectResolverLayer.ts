import { Context, Deferred, Effect, Layer, Option } from "effect";
import type { Rpc } from "effect/rpc";
import type { Permission } from "@shivaedev/access/permission.ts";
import { unauthorized } from "@shivaedev/access/refusal.ts";
import { DefinedModule } from "@shivaedev/contract/defineModule.ts";
import { operationKind } from "@shivaedev/contract/operationKind.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { subjectHeader } from "@shivaedev/contract/subjectHeader.ts";
import { Identity, SessionUser } from "#identity.ts";
import type { IdentityFailures } from "#middleware.ts";
import { hasPermission } from "#permission.ts";
import { decodeSessionUser } from "#server/decodeSessionUser.ts";
import { recheckSession } from "#server/recheckSession.ts";
import { revalidateStream } from "#server/revalidateStream.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { SubjectRecheck } from "#server/SubjectRecheck.ts";
import { resolveSession } from "#server/session.ts";
import { transportHeaders } from "#server/transportHeaders.ts";
import { type DelegationRequest, type DelegationRule, Subject, SubjectId, type SubjectMiddleware, SubjectResolver } from "#subject.ts";

type Policy<E> =
	| { readonly kind: "self" }
	| { readonly kind: "account"; readonly permission: Permission; readonly deny: (id: string) => E }
	| { readonly kind: "delegated"; readonly rule: DelegationRule<E>; readonly deny: (id: string) => E };

function delegationRequest(rpc: Rpc.AnyWithProps, subject: string): DelegationRequest {
	const module = Option.getOrElse(Context.getOption(rpc.annotations, DefinedModule), () => rpc._tag.slice(0, rpc._tag.lastIndexOf(".")));
	return { kind: operationKind(rpc), module, operation: rpc._tag.slice(module.length + 1), subject: SubjectId(subject) };
}

// The one place that decides whether an actor may act for a subject; the guard asks it before the handler runs, at every stream
// recheck and, for a delegated subject, before each update a live query's changes stream sends.
function authorize<E>(
	policy: Policy<E>,
	actor: Parameters<typeof hasPermission>[0],
	subject: string,
	rpc: Rpc.AnyWithProps,
): Effect.Effect<void, E | IdentityFailures> {
	if (policy.kind === "self" || subject === actor.id) {
		return Effect.void;
	}
	if (policy.kind === "account") {
		return hasPermission(actor, { ...policy.permission, strength: "any" }) ? Effect.void : Effect.fail(policy.deny(subject));
	}
	return policy.rule.allows(delegationRequest(rpc, subject)).pipe(
		Effect.provideService(CurrentViewer, Option.some({ id: actor.id })),
		Effect.flatMap((allowed) => (allowed ? Effect.void : Effect.fail(policy.deny(subject)))),
	);
}

function recheckEachUpdate<E>(check: Effect.Effect<void, E>) {
	return <A, TError, R>(effect: Effect.Effect<A, TError, R>) =>
		Effect.flatMap(Deferred.make<never, E>(), (refused) =>
			Effect.raceFirst(
				Effect.provideService(
					effect,
					SubjectRecheck,
					Effect.catch(check, (error) => Effect.andThen(Deferred.fail(refused, error), Effect.never)),
				),
				Deferred.await(refused),
			),
		);
}

function guard<E>(policy: Policy<E>): SubjectMiddleware<E, SessionPolicy> {
	return (effect, { headers, rpc }) =>
		Effect.gen(function* () {
			const session = yield* resolveSession(headers, rpc._tag);
			if (Option.isNone(session)) {
				return yield* unauthorized();
			}
			const user = session.value.user;
			const sessionUser = yield* decodeSessionUser(user);
			// RPC merges each call's message headers over its transport's, so the call's own subject comes first and a subject set on the
			// socket upgrade is the fallback. The subject is the only header taken from the message: it names what to act on, and the
			// authorization below decides whether that is allowed, while the session, origin and cookies stay bound to the transport.
			const wanted = subjectHeader(headers) ?? subjectHeader(yield* transportHeaders(headers));
			const id = policy.kind === "self" ? user.id : (wanted ?? user.id);
			yield* authorize(policy, user, id, rpc);
			const lookup = recheckSession(headers, rpc._tag).pipe(
				Effect.tap((next) => (Option.isSome(next) ? authorize(policy, next.value.user, id, rpc) : Effect.void)),
			);
			const delegated = policy.kind === "delegated" && id !== user.id;
			return yield* effect.pipe(
				delegated ? recheckEachUpdate(authorize(policy, user, id, rpc)) : (handled) => handled,
				revalidateStream(rpc, user.id, lookup),
				Effect.provideService(Subject, { id: SubjectId(id) }),
				Effect.provideService(Identity, { id: user.id }),
				Effect.provideService(SessionUser, sessionUser),
				Effect.provideService(CurrentViewer, Option.some({ id: user.id })),
			);
		});
}

export function subjectResolverLayer() {
	return Layer.effect(
		SubjectResolver,
		Effect.map(Effect.serviceOption(SessionPolicy), (sessions) => {
			function resolved<E>(policy: Policy<E>): SubjectMiddleware<E> {
				const middleware = guard(policy);
				return (effect, request) =>
					Option.isSome(sessions)
						? middleware(effect, request).pipe(Effect.provideService(SessionPolicy, sessions.value))
						: Effect.fail(unauthorized());
			}
			return {
				account: <E>(permission: Permission, deny: (id: string) => E) => resolved({ deny, kind: "account", permission }),
				delegated: <E>(rule: DelegationRule<E>, deny: (id: string) => E) => resolved({ deny, kind: "delegated", rule }),
				self: resolved({ kind: "self" }),
			};
		}),
	);
}
