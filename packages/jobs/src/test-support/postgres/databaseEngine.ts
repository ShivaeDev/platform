import type { Context, Effect, Fiber, Redacted, Schema } from "effect";
import type { SqlClient } from "effect/sql";
import { type PgBoss, TestClock } from "pg-boss";
import type { WorkerRelease } from "@shivaedev/sql/WorkerRelease.ts";
import type { disconnectProxy } from "@shivaedev/test-sql/server/disconnectProxy.ts";
import type { PgBossClient } from "#server/client.ts";
import type { JobPayloadSchema } from "#server/definition.ts";
import type { PgBossService } from "#server/service.ts";
import type { PgBossTesting } from "#server/testing.ts";
import { recordingTracer } from "#test/recordingTracer.ts";
import { type WorkLog, workLog } from "#test/workers.ts";

export interface Runtime {
	readonly client: PgBossClient;
	readonly jobs: PgBossService;
	readonly queues: readonly string[];
	readonly startedAt: number;
	readonly stop: Effect.Effect<void>;
	readonly testing: PgBossTesting | undefined;
	readonly worked: readonly string[];
}

export interface StoryPayload extends JobPayloadSchema {
	readonly DecodingServices: never;
	readonly EncodingServices: never;
}

export interface Labelled {
	readonly id: string;
	readonly queue: { readonly name: string; readonly schema: StoryPayload | typeof Schema.Null };
}

export interface Release {
	readonly service: Context.Service.Shape<typeof WorkerRelease>;
	readonly setActive: (active: boolean) => Effect.Effect<void, unknown>;
}

export interface DatabaseEngine {
	readonly admins: Map<string, PgBoss>;
	answered: unknown;
	readonly budgetWaits: Map<string, Fiber.Fiber<unknown>>;
	readonly changeWatches: Map<string, Fiber.Fiber<number>>;
	readonly clock: TestClock;
	readonly controllers: PgBossTesting[];
	readonly enqueuedAt: Map<string, number>;
	readonly fetchWatches: Map<string, Fiber.Fiber<unknown, unknown>>;
	gate: Effect.Success<ReturnType<typeof disconnectProxy>> | undefined;
	readonly idleReads: ("after the busy work went on" | "while work was busy")[];
	readonly idleWaits: Map<string, Fiber.Fiber<void, unknown>>;
	readonly inspectionWatches: Map<
		string,
		{
			readonly revision: number;
			readonly signal: { readonly revision: Effect.Effect<number>; readonly waitForChange: (after: number) => Effect.Effect<number> };
		}
	>;
	readonly jobs: Map<string, Labelled>;
	readonly labels: Map<string, string>;
	readonly logs: {
		readonly annotations: Readonly<Record<string, unknown>>;
		readonly level: string;
		readonly message: unknown;
		readonly runtime: string;
		readonly spanId: string | undefined;
	}[];
	readonly pgBossStops: string[];
	readonly pollers: Map<string, (workerId: string) => void>;
	release: Release | undefined;
	readonly reported: string[];
	readonly revisionMarks: Map<string, number>;
	readonly runtimes: Map<string, Runtime>;
	seenBeforeCommit: unknown;
	readonly sharedClients: Map<string | symbol, PgBossClient>;
	readonly sql: SqlClient.SqlClient;
	readonly startups: Map<string, string>;
	readonly stopping: Map<string, Fiber.Fiber<void>>;
	readonly timeline: string[];
	readonly trace: ReturnType<typeof recordingTracer>;
	readonly url: Redacted.Redacted<string>;
	readonly wakes: Map<string, string[]>;
	readonly work: WorkLog;
}

export function databaseEngine(url: Redacted.Redacted<string>, sql: SqlClient.SqlClient, now: number): DatabaseEngine {
	const work = workLog();
	const timeline: string[] = [];
	const labels = new Map<string, string>();
	let finished = 0;
	work.changed.add(() => {
		for (const { id } of work.finished.slice(finished)) {
			timeline.push(`${labels.get(id) ?? id} finished`);
		}
		finished = work.finished.length;
	});
	return {
		admins: new Map(),
		answered: "nothing asked yet",
		budgetWaits: new Map(),
		changeWatches: new Map(),
		clock: new TestClock(now),
		controllers: [],
		enqueuedAt: new Map(),
		fetchWatches: new Map(),
		gate: undefined,
		idleReads: [],
		idleWaits: new Map(),
		inspectionWatches: new Map(),
		jobs: new Map(),
		labels,
		logs: [],
		pgBossStops: [],
		pollers: new Map(),
		release: undefined,
		reported: [],
		revisionMarks: new Map(),
		runtimes: new Map(),
		seenBeforeCommit: undefined,
		sharedClients: new Map(),
		sql,
		startups: new Map(),
		stopping: new Map(),
		timeline,
		trace: recordingTracer(),
		url,
		wakes: new Map(),
		work,
	};
}
