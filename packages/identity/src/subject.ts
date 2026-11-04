import { Brand, Context, Effect, Schema } from "effect";
import type { RpcMiddleware } from "effect/rpc";
import type { Permission } from "@shivaedev/access/permission.ts";
import type { TaggedRejection } from "@shivaedev/contract/rejection.ts";
import type { SubjectDeclaration } from "@shivaedev/contract/subject.ts";
import type { Identity, SessionUser } from "#identity.ts";
import { IdentityFailures } from "#middleware.ts";

export type SubjectId = string & Brand.Brand<"@shivaedev/identity/SubjectId">;
export const SubjectId = Brand.nominal<SubjectId>();
export class Subject extends Context.Service<Subject, { readonly id: SubjectId }>()("@shivaedev/identity/Subject") {}

export type SubjectMiddleware<E = never, R = never> = RpcMiddleware.RpcMiddleware<Subject | Identity | SessionUser, IdentityFailures | E, R>;

export class SubjectResolver extends Context.Service<
	SubjectResolver,
	{
		readonly self: SubjectMiddleware;
		readonly account: <E>(permission: Permission, deny: (id: string) => E) => SubjectMiddleware<E>;
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
