import { Effect, Layer, Option, Schema } from "effect";
import type { Permission } from "@shivaedev/access/permission.ts";
import { CurrentViewer } from "@shivaedev/contract/readPolicy.ts";
import { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { Identity, SessionUser, SessionUserSchema } from "#identity.ts";
import { hasPermission } from "#permission.ts";
import { recheckSession } from "#server/recheckSession.ts";
import { revalidateStream } from "#server/revalidateStream.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { resolveSession } from "#server/session.ts";
import { transportHeaders } from "#server/transportHeaders.ts";
import { Subject, SubjectId, type SubjectMiddleware, SubjectResolver } from "#subject.ts";

type Policy<E> = { readonly kind: "self" } | { readonly kind: "account"; readonly permission: Permission; readonly deny: (id: string) => E };

function guard<E>(policy: Policy<E>): SubjectMiddleware<E, SessionPolicy> {
	return (effect, { headers, rpc }) =>
		Effect.gen(function* () {
			const session = yield* resolveSession(headers, rpc._tag);
			if (Option.isNone(session)) {
				return yield* new Unauthorized({ message: "Authentication required" });
			}
			const user = session.value.user;
			const transport = yield* transportHeaders(headers);
			const id = policy.kind === "self" ? user.id : (transport["x-platform-subject"] ?? user.id);
			if (policy.kind === "account" && id !== user.id && !hasPermission(user, { ...policy.permission, strength: "any" })) {
				return yield* Effect.fail(policy.deny(id));
			}
			const lookup = recheckSession(headers, rpc._tag).pipe(
				Effect.tap((next) =>
					Option.isSome(next)
					&& policy.kind === "account"
					&& id !== next.value.user.id
					&& !hasPermission(next.value.user, { ...policy.permission, strength: "any" })
						? Effect.fail(policy.deny(id))
						: Effect.void,
				),
			);
			return yield* effect.pipe(
				revalidateStream(rpc, user.id, lookup),
				Effect.provideService(Subject, { id: SubjectId(id) }),
				Effect.provideService(Identity, { id: user.id }),
				Effect.provideService(SessionUser, Schema.decodeUnknownSync(SessionUserSchema)(user)),
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
						: Effect.fail(new Unauthorized({ message: "Authentication required" }));
			}
			return {
				account: <E>(permission: Permission, deny: (id: string) => E) => resolved({ deny, kind: "account", permission }),
				self: resolved({ kind: "self" }),
			};
		}),
	);
}
