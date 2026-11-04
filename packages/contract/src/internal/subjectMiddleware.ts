import { RpcMiddleware } from "effect/rpc";
import type { SubjectDeclaration, SubjectProvides } from "#subject.ts";

export const SUBJECT_TYPE_ID = "@shivaedev/contract/SubjectDeclaration";

export interface SubjectMiddleware<TSubject extends SubjectDeclaration> extends RpcMiddleware.AnyId {
	readonly [RpcMiddleware.TypeId]: {
		readonly provides: SubjectProvides<TSubject>;
		readonly requires: never;
		readonly error: TSubject["error"];
		readonly clientError: never;
	};
}

export function subjectMiddleware<TSubject extends SubjectDeclaration>(name: string, subject: TSubject) {
	const error: TSubject["error"] = subject.error;
	const middleware = RpcMiddleware.Service<SubjectMiddleware<TSubject>, { provides: SubjectProvides<TSubject> }>()(
		`@shivaedev/contract/Subject/${name}`,
		{ error },
	);
	return Object.assign(middleware, { [SUBJECT_TYPE_ID]: subject });
}
