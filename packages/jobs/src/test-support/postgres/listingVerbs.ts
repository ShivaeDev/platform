import { DateTime, Effect, Option } from "effect";
import type { DeadLetteredJob, JobPage, ListedJob } from "#health.ts";
import type { DatabaseEngine, StoryPayload } from "./databaseEngine.ts";
import { errorOf, labelOf, provided, runningIn } from "./engine.ts";

type Listing = "failed" | "dead-lettered";
type Listed = ListedJob<unknown> | DeadLetteredJob<unknown>;
interface ListedQueue {
	readonly name: string;
	readonly schema: StoryPayload;
}

function nameOf(engine: DatabaseEngine, job: Listed): string {
	return "sourceId" in job ? `copy of ${labelOf(engine, Option.getOrUndefined(job.sourceId))}` : labelOf(engine, job.id);
}

function times(job: Listed): string {
	const stamps = [job.createdOn, ...Option.toArray(job.startedOn), ...Option.toArray(job.completedOn)];
	const utc = stamps.every((stamp) => DateTime.isDateTime(stamp) && DateTime.isUtc(stamp));
	const ordered = stamps.every((stamp, index) => index === 0 || DateTime.toEpochMillis(stamp) >= DateTime.toEpochMillis(stamps[index - 1] ?? stamp));
	return `${stamps.length} UTC times${utc ? "" : " (not all UTC)"}${ordered ? " in order" : " out of order"}`;
}

function row(engine: DatabaseEngine, job: Listed) {
	return {
		attempt: job.attempt,
		data: job.data,
		error: errorOf(job.output),
		job: nameOf(engine, job),
		queue: job.queue,
		retryCount: job.retryCount,
		retryLimit: job.retryLimit,
		state: job.state,
		times: times(job),
		...("sourceId" in job ? { source: labelOf(engine, Option.getOrUndefined(job.sourceId)), sourceError: errorOf(job.sourceOutput) } : {}),
	};
}

export function listingVerbs(engine: DatabaseEngine, tell: (line: string) => void) {
	let cursor: Option.Option<string> = Option.none();
	let last: { readonly name: string; readonly listing: Listing; readonly queue: ListedQueue; readonly limit: number } | undefined;
	function page(name: string, listing: Listing, queue: ListedQueue, limit: number, from: Option.Option<string>) {
		return Effect.suspend(() => {
			const jobs = runningIn(engine, name).jobs;
			const options = { limit, ...(Option.isSome(from) ? { cursor: from.value } : {}) };
			const read: Effect.Effect<JobPage<Listed>, unknown> = listing === "failed"
				? jobs.failedJobs(queue, options)
				: jobs.deadLetteredJobs(queue, options);
			return provided(engine, name, read);
		});
	}
	const remaining = Effect.gen(function* () {
		if (last === undefined) {
			return yield* Effect.die(new Error("No page was read yet"));
		}
		const pages: string[][] = [];
		while (Option.isSome(cursor)) {
			const next = yield* page(last.name, last.listing, last.queue, last.limit, cursor);
			pages.push(next.jobs.map((job) => nameOf(engine, job)));
			cursor = next.next;
		}
		return pages;
	});
	return {
		firstPage: (name: string, listing: Listing, queue: ListedQueue, limit: number) => {
			tell(`${name} reads the first page of ${limit} ${listing} ${queue.name} jobs`);
			return Effect.map(page(name, listing, queue, limit, Option.none()), (first) => {
				cursor = first.next;
				last = { limit, listing, name, queue };
				return first.jobs.map((job) => nameOf(engine, job));
			});
		},
		listed: (name: string, listing: Listing, queue: ListedQueue) =>
			Effect.map(page(name, listing, queue, 100, Option.none()), ({ jobs, next }) => ({
				jobs: jobs.map((job) => row(engine, job)),
				next: Option.isSome(next) ? "another page" : "no further page",
			})),
		listedNames: (name: string, listing: Listing, queue: ListedQueue) =>
			Effect.map(page(name, listing, queue, 100, Option.none()), ({ jobs }) => jobs.map((job) => nameOf(engine, job))),
		remainingPages: () => {
			tell("the remaining pages are read from the first page's cursor");
			return remaining;
		},
	};
}
