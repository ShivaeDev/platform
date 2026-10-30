import { Effect, Option, Queue, Ref, Schema } from "effect";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { Access } from "./Access.ts";
import { jobsEngine, postgresConfigured, postgresLayer } from "./jobsEngine.ts";
import { describeCopy, describeJob, firstPage, idOf, nameCopies, named, nameOf, nextPage, type Page, refused, sourceOf, views } from "./jobsNames.ts";
import { Mail, Scheduled, Sync } from "./jobsPages.ts";

export type JobsView = keyof ReturnType<typeof views>;

export const jobsStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => jobsEngine,
	inspect: ({ deliveries, names }) => ({ deliveries: deliveries.map((id) => names.get(id) ?? id), jobs: [...names.values()] }),
	layer: postgresLayer,
	name: "admin jobs",
	runIf: postgresConfigured,
	stages: ["session", "jobs", "statistics", "views"],
	verbs: (engine, story) => {
		const { client } = engine;
		return {
			counts: (queue: string) => {
				story.tell(`read the counts of ${queue}`);
				return refused(engine, client["admin.jobs.counts"]({ queue }));
			},
			deadLettered: (queue: string, page: Page = firstPage) => {
				story.tell(`list the dead-lettered jobs of ${queue}`);
				return refused(
					engine,
					client["admin.jobs.deadLettered"]({ ...page, queue }).pipe(
						Effect.map((listed) => ({ copies: listed.jobs.map((copy) => describeCopy(engine, copy)), next: nextPage(engine, listed.next) })),
					),
				);
			},
			deadLetteredPaging: (queue: string, limit: number) =>
				Effect.gen(function* () {
					story.tell(`page through the dead-lettered jobs of ${queue}, ${limit} at a time`);
					const pageSizes: number[] = [];
					const copiesOf: string[] = [];
					let cursor: string | undefined;
					do {
						const listed = yield* client["admin.jobs.deadLettered"]({ ...(cursor === undefined ? {} : { cursor }), limit, queue });
						pageSizes.push(listed.jobs.length);
						copiesOf.push(...listed.jobs.map((copy) => sourceOf(engine, copy)));
						cursor = Option.getOrUndefined(listed.next);
					} while (cursor !== undefined);
					return { copiesOf: copiesOf.toSorted((left, right) => left.localeCompare(right)), pageSizes };
				}),
			deliveries: () => Effect.sync(() => engine.deliveries.map((id) => nameOf(engine, id))),
			detail: (name: string, queue: string = Mail.name) => {
				story.tell(`read the detail of ${name} in ${queue}`);
				return client["admin.jobs.job"]({ id: idOf(engine, name), queue }).pipe(Effect.map(Option.getOrThrow));
			},
			failedEntry: (name: string, queue: string = Mail.name) => {
				story.tell(`find ${name} among the failed jobs of ${queue}`);
				return client["admin.jobs.failed"]({ ...firstPage, queue }).pipe(
					Effect.map((listed) => {
						const entry = listed.jobs.find(({ id }) => id === idOf(engine, name));
						if (entry === undefined) {
							throw new Error(`${name} is not among the failed jobs of ${queue}`);
						}
						return entry;
					}),
				);
			},
			failedJobs: (queue: string, page: Page = firstPage) => {
				story.tell(`list the failed jobs of ${queue}`);
				return refused(
					engine,
					client["admin.jobs.failed"]({ ...page, queue }).pipe(
						Effect.map((listed) => ({ jobs: listed.jobs.map((job) => describeJob(engine, job)), next: nextPage(engine, listed.next) })),
					),
				);
			},
			failedPages: (queue: string, limit: number) =>
				Effect.gen(function* () {
					story.tell(`page through the failed jobs of ${queue}, ${limit} at a time`);
					const pages: string[][] = [];
					let cursor: string | undefined;
					do {
						const listed = yield* client["admin.jobs.failed"]({ ...(cursor === undefined ? {} : { cursor }), limit, queue });
						pages.push(listed.jobs.map(({ id }) => nameOf(engine, id)));
						cursor = Option.getOrUndefined(listed.next);
					} while (cursor !== undefined);
					return pages;
				}),
			health: () => {
				story.tell("read the health of the page's queues");
				return refused(engine, client["admin.jobs.health"]());
			},
			job: (name: string, queue: string) => {
				story.tell(`read ${name} in ${queue}`);
				return refused(
					engine,
					client["admin.jobs.job"]({ id: idOf(engine, name), queue }).pipe(
						Effect.map(Option.match({ onNone: () => "no job", onSome: (job) => describeJob(engine, job) })),
					),
				);
			},
			lastAnswerOnTheWire: () => Effect.sync(() => engine.responses.at(-1) ?? "no answer"),
			nextAnswer: (view: JobsView) => {
				story.tell(`wait for the next answer of the mounted ${view} view`);
				const answers = engine.views.get(view);
				if (answers === undefined) {
					throw new Error(`The ${view} view is not mounted`);
				}
				return Queue.take(answers).pipe(Effect.timeoutOrElse({ duration: "5 seconds", orElse: () => Effect.succeed("no fresh answer") }));
			},
			pgBossReadsSinceRegistration: () => Effect.sync(engine.registrationReads),
			pgBossStops: () => {
				story.tell("pg-boss stops");
				return engine.stopJobs;
			},
			profile: () => {
				story.tell("read the caller's profile");
				return refused(engine, client["admin.users.profile"]());
			},
			retry: (name: string, queue: string = Mail.name) => {
				story.tell(`retry ${name} in ${queue}`);
				return refused(engine, engine.run(engine.api.retry.run({ id: idOf(engine, name), queue })).pipe(Effect.as("retried")));
			},
			stateOf: (name: string, queue: string = Mail.name) => {
				story.tell(`read the state of ${name} in ${queue}`);
				return refused(
					engine,
					client["admin.jobs.job"]({ id: idOf(engine, name), queue }).pipe(
						Effect.map(Option.match({ onNone: () => "no job", onSome: ({ state }) => state })),
					),
				);
			},
			workersFinish: () => {
				story.tell("the workers finish every job they can take");
				return engine.testing.waitForIdle;
			},
		};
	},
});

export const signedOut = jobsStory.trait("session", "no caller is signed in", ({ session }) => Ref.set(session, Option.none()));

export function signedInAs(role: typeof Access.Role.Type) {
	return jobsStory.trait("session", `the caller is signed in as ${role}`, ({ session }) =>
		Ref.set(session, Option.some({ user: { email: `${role}@example.test`, id: role, name: role, role } })),
	);
}

export function mailFails(...ids: readonly number[]) {
	return jobsStory.trait("jobs", `${ids.map((id) => `mail ${id}`).join(", ")} failed on first delivery and moved to mail-dlq`, function* (engine) {
		for (const id of ids) {
			named(engine, Option.getOrThrow(yield* engine.jobs.enqueue(Mail, { id }, { retryLimit: 0 })), `mail ${id}`);
		}
		yield* engine.testing.waitForIdle;
		const copies = yield* engine.jobs.deadLetteredJobs(Mail, { limit: 100 });
		nameCopies(engine, copies.jobs, (source) => `the dead-letter copy of ${source}`);
	});
}

export const syncWaits = jobsStory.trait("jobs", "the waiting sync job has no worker to take it", function* (engine) {
	named(engine, Option.getOrThrow(yield* engine.jobs.enqueue(Sync, { key: "sync-key" })), "the waiting sync job");
});

export const privateWaits = jobsStory.trait("jobs", "a job waits in the private queue, which the Jobs page does not show", function* (engine) {
	named(engine, Option.getOrThrow(yield* engine.jobs.enqueue(engine.privateQueue, { id: 9 })), "the private job");
});

export const invalidMailFails = jobsStory.trait(
	"jobs",
	"the invalid mail job, whose payload does not match the mail schema, failed",
	function* (engine) {
		named(engine, yield* engine.sendInvalidMail, "the invalid mail job");
		yield* engine.testing.waitForIdle;
	},
);

export const scheduledRunFails = jobsStory.trait("jobs", "the scheduled run was triggered, failed and moved to scheduled-dlq", function* (engine) {
	yield* engine.testing.trigger(Scheduled);
	yield* engine.testing.waitForIdle;
	const { jobs } = yield* engine.jobs.failedJobs({ name: Scheduled.name, schema: Schema.Null }, { limit: 10 });
	for (const run of jobs) {
		named(engine, run.id, "the scheduled run");
	}
	const copies = yield* engine.jobs.deadLetteredJobs({ name: Scheduled.name, schema: Schema.Null }, { limit: 10 });
	nameCopies(engine, copies.jobs, () => "the scheduled run's dead-letter copy");
});

export const statisticsRefreshed = jobsStory.trait("statistics", "pg-boss refreshes its queue statistics", (engine) => engine.refreshStatistics);

export function mounted(view: JobsView) {
	return jobsStory.trait("views", `the ${view} view is mounted`, function* (engine) {
		const answers = yield* Queue.unbounded<unknown>();
		engine.views.set(view, answers);
		const unsubscribe = views(engine)[view]()(engine.registry, (answer) => Queue.offerUnsafe(answers, answer));
		yield* Effect.addFinalizer(() => Effect.sync(unsubscribe));
	});
}
