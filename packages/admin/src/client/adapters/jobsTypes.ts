import type { Option } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type { JobsDeadLetter } from "#jobs/DeadLetter.ts";
import type { JobsRow } from "#jobs/Row.ts";
import type { JobsHealth, QueueCounts } from "#jobs/schemas.ts";

export type AdminJob = JobsRow | JobsDeadLetter;
interface JobId {
	readonly id: string;
	readonly queue: string;
}
interface PageInput {
	readonly cursor?: string;
	readonly limit: number;
	readonly queue: string;
}
interface Page<A> {
	readonly jobs: readonly A[];
	readonly next: Option.Option<string>;
}
interface Query<TInput, A> {
	readonly query: (input: TInput) => Atom.Atom<AsyncResult.AsyncResult<A, unknown>>;
}
export interface JobsViewClient {
	readonly counts: Query<{ readonly queue: string }, typeof QueueCounts.Type>;
	readonly deadLettered: Query<PageInput, Page<JobsDeadLetter>>;
	readonly failed: Query<PageInput, Page<JobsRow>>;
	readonly health: Query<void, typeof JobsHealth.Type>;
	readonly job: Query<JobId, Option.Option<JobsRow>>;
}
export type RetryJob = Atom.AtomResultFn<JobId, void, unknown>;

export type RunScheduleNow = Atom.AtomResultFn<{ readonly queue: string }, Option.Option<string>, unknown>;
