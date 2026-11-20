import { Brand, Context, Effect, Option, Schema } from "effect";
import type { RpcMiddleware } from "effect/rpc";
import type { Permission } from "@shivaedev/access/permission.ts";
import type { TaggedRejection } from "@shivaedev/contract/rejection.ts";
import type { SubjectDeclaration } from "@shivaedev/contract/subject.ts";
import { DelegationRuleMissing } from "#DelegationRuleMissing.ts";
import type { Identity, SessionUser } from "#identity.ts";
import { IdentityFailures } from "#middleware.ts";

export type SubjectId = string & Brand.Brand<"@shivaedev/identity/SubjectId">;
export const SubjectId = Brand.nominal<SubjectId>();
export class Subject extends Context.Service<Subject, { readonly id: SubjectId }>()("@shivaedev/identity/Subject") {}

export type SubjectMiddleware<E = never, R = never> = RpcMiddleware.RpcMiddleware<Subject | Identity | SessionUser, IdentityFailures | E, R>;

// What the guard asks an application's delegation rule about one call. A query, a live query's changes stream and any other stream
// read; a command writes.
export interface DelegationRequest {
	readonly kind: "read" | "write";
	readonly module: string;
	readonly operation: string;
	readonly subject: SubjectId;
}

export interface DelegationRule<E = never> {
	readonly allows: (request: DelegationRequest) => Effect.Effect<boolean, IdentityFailures | E>;
}

export class SubjectResolver extends Context.Service<
	SubjectResolver,
	{
		readonly self: SubjectMiddleware;
		readonly account: <E>(permission: Permission, deny: (id: string) => E) => SubjectMiddleware<E>;
		readonly delegated: <E>(rule: DelegationRule<E>, deny: (id: string) => E) => SubjectMiddleware<E>;
	}
>()("@shivaedev/identity/SubjectResolver") {}

export const selfSubject = {
	error: IdentityFailures,
	middleware: Effect.map(SubjectResolver, (resolver) => resolver.self),
} satisfies SubjectDeclaration;

export function accountSubject<TRefusal extends TaggedRejection>(options: {
	readonly permission: Permission;
	readonly refusal: TRefusal;
	readonly deny: (id: string) => NoInfer<TRefusal["Type"]>;
}) {
	return {
		error: Schema.Union([IdentityFailures, options.refusal]),
		middleware: Effect.map(SubjectResolver, (resolver) => resolver.account(options.permission, options.deny)),
	} satisfies SubjectDeclaration;
}

export function delegatedSubject<const TService extends string, TRefusal extends TaggedRejection>(options: {
	readonly service: TService;
	readonly refusal: TRefusal;
	readonly deny: (id: string) => NoInfer<TRefusal["Type"]>;
}) {
	const rule = Context.Service<TService, DelegationRule<TRefusal["Type"]>>(options.service);
	// The rule is looked up optionally so a host without it fails to start with a message naming it; the declared requirement
	// still makes the compiler reject that host first.
	const middleware: Effect.Effect<SubjectMiddleware<TRefusal["Type"]>, DelegationRuleMissing, SubjectResolver | TService> = Effect.gen(function* () {
		const resolver = yield* SubjectResolver;
		const found = yield* Effect.serviceOption(rule);
		if (Option.isNone(found)) {
			return yield* new DelegationRuleMissing({ service: options.service });
		}
		return resolver.delegated(found.value, options.deny);
	});
	const declaration = { error: Schema.Union([IdentityFailures, options.refusal]), middleware } satisfies SubjectDeclaration;
	return { ...declaration, service: options.service };
}
