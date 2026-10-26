import type { Option, Schema } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type { JobFields, JobsHealth, QueueCounts } from "@shivaedev/admin/jobs/schemas.ts";

export type AdminJob = Schema.Struct.Type<typeof JobFields> & {
	readonly data: object;
	readonly queue: string;
	readonly sourceId?: Option.Option<string>;
	readonly sourceOutput?: unknown;
};
interface Query<TInput, A> {
	readonly query: (input: TInput) => Atom.Atom<AsyncResult.AsyncResult<A, unknown>>;
}
interface Listing {
	readonly jobs: readonly AdminJob[];
	readonly next: Option.Option<string>;
}
interface PageInput {
	readonly cursor?: string;
	readonly limit: number;
	readonly queue: string;
}
export interface JobsViewClient {
	readonly counts: Query<{ readonly queue: string }, typeof QueueCounts.Type>;
	readonly deadLettered: Query<PageInput, Listing>;
	readonly failed: Query<PageInput, Listing>;
	readonly health: Query<void, typeof JobsHealth.Type>;
	readonly job: Query<{ readonly queue: string; readonly id: string }, Option.Option<AdminJob>>;
}
export type RetryJob = Atom.AtomResultFn<{ readonly queue: string; readonly id: string }, void, unknown>;
