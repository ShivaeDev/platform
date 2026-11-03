import type { Option, Schema } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type { deadLetteredSchema, JobsHealth, jobSchema, QueueCounts } from "#jobs/schemas.ts";

type Job = ReturnType<typeof jobSchema<typeof Schema.Unknown>>["Type"];
type DeadLetter = ReturnType<typeof deadLetteredSchema<typeof Schema.Unknown>>["Type"];
export type AdminJob = Job | DeadLetter;
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
	readonly deadLettered: Query<PageInput, Page<DeadLetter>>;
	readonly failed: Query<PageInput, Page<Job>>;
	readonly health: Query<void, typeof JobsHealth.Type>;
	readonly job: Query<JobId, Option.Option<Job>>;
}
export type RetryJob = Atom.AtomResultFn<JobId, void, unknown>;
