import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type { foundation } from "#modules.ts";

type JobsQuery = (typeof foundation.JobsPage.contract.declaration.queries)[number];
type Operation<TName extends JobsQuery["name"]> = Extract<JobsQuery, { readonly name: TName }>;
type Success<TName extends JobsQuery["name"]> = Operation<TName>["success"]["Type"];
export type AdminJob = Success<"failed">["jobs"][number] | Success<"deadLettered">["jobs"][number];
interface Query<TInput, A> {
	readonly query: (input: TInput) => Atom.Atom<AsyncResult.AsyncResult<A, unknown>>;
}
export type JobsViewClient = {
	readonly [TName in JobsQuery["name"]]: Query<Operation<TName>["payload"]["Type"], Success<TName>>;
};
export type RetryJob = Atom.AtomResultFn<Operation<"job">["payload"]["Type"], void, unknown>;
