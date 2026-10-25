import { Effect, Option, Ref, Schedule } from "effect";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import type { JobsHealth } from "#jobs/schemas.ts";
import { jobsEngine, postgresConfigured, postgresLayer } from "./jobsEngine.ts";

export const jobsStory = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: () => jobsEngine,
	layer: postgresLayer,
	name: "admin jobs",
	runIf: postgresConfigured,
	stages: ["session"],
	verbs: (
		{ api, registry, run, deliveries, client, jobs, privateQueue, queue, registrationReads, responses, sendInvalid, stopJobs, sync, testing },
		story,
	) => ({
		api,
		counts: (name: string = queue.name) => {
			story.tell(`read counts for ${name}`);
			return client["admin.jobs.counts"]({ queue: name });
		},
		deadLettered: (limit: number, cursor?: string, name: string = queue.name) => {
			story.tell(`list dead-lettered jobs in ${name}`);
			return client["admin.jobs.deadLettered"]({ ...(cursor === undefined ? {} : { cursor }), limit, queue: name });
		},
		deliveries: () => [...deliveries],
		failed: (limit: number, cursor?: string, name: string = queue.name) => {
			story.tell(`list failed jobs in ${name}`);
			return client["admin.jobs.failed"]({ ...(cursor === undefined ? {} : { cursor }), limit, queue: name });
		},
		health: () => {
			story.tell("read registered queues' health");
			return client["admin.jobs.health"]();
		},
		job: (id: string, name: string = queue.name) => {
			story.tell(`read job ${id} in ${name}`);
			return client["admin.jobs.job"]({ id, queue: name });
		},
		profile: () => client["admin.users.profile"](),
		registrationReads,
		registry,
		responses: () => responses,
		retry: (id: string, name: string = queue.name) => {
			story.tell(`retry job ${id} in ${name}`);
			return run(api.retry.run({ id, queue: name }));
		},
		send: (id: number) => jobs.enqueue(queue, { id }, { retryLimit: 0 }).pipe(Effect.map(Option.getOrThrow)),
		sendInvalid,
		sendPrivate: () => jobs.enqueue(privateQueue, { id: 9 }),
		sendSync: () => jobs.enqueue(sync, { key: "sync-key" }).pipe(Effect.map(Option.getOrThrow)),
		settle: () => testing.waitForIdle,
		stopJobs: () => stopJobs,
		waitForHealth: (ready: (health: typeof JobsHealth.Type) => boolean) =>
			client["admin.jobs.health"]().pipe(Effect.repeat({ schedule: Schedule.spaced("25 millis"), until: ready }), Effect.timeout("10 seconds")),
	}),
});

export function jobsRole(role: string) {
	return jobsStory.trait("session", `a caller already has the ${role} role`, ({ session }) =>
		Ref.set(session, Option.some({ user: { email: "operator@example.test", id: "operator", name: "Operator", role } })),
	);
}
