import type { Context, Effect, Fiber } from "effect";
import type { SqlClient } from "effect/sql";
import type { PgBoss } from "pg-boss";
import type { WorkerRelease } from "@shivaedev/sql/WorkerRelease.ts";
import type { PgBossClient } from "#client.ts";
import type { JobPayloadSchema, QueueDefinition } from "#definition.ts";
import type { PgBossService } from "#service.ts";
import { recordingTracer } from "#test/recordingTracer.ts";
import { type WorkLog, workLog } from "#test/workers.ts";
import type { PgBossTesting } from "#testing.ts";
import type { DisconnectGate } from "./disconnectGate.ts";

export interface Runtime {
	readonly client: PgBossClient;
	readonly jobs: PgBossService;
	readonly queues: readonly string[];
	readonly startedAt: number;
	readonly stop: Effect.Effect<void>;
	readonly testing: PgBossTesting | undefined;
}

export interface StoryPayload extends JobPayloadSchema {
	readonly DecodingServices: never;
	readonly EncodingServices: never;
}

export interface Labelled {
	readonly id: string;
	readonly queue: Pick<QueueDefinition<string, StoryPayload>, "name" | "schema">;
}

export interface Release {
	readonly service: Context.Service.Shape<typeof WorkerRelease>;
	readonly setActive: (active: boolean) => Effect.Effect<void, unknown>;
}

export interface DatabaseEngine {
	readonly admins: Map<string, PgBoss>;
	answered: unknown;
	readonly changeWatches: Map<string, Fiber.Fiber<number>>;
	readonly controllers: PgBossTesting[];
	readonly enqueuedAt: Map<string, number>;
	gate: DisconnectGate | undefined;
	readonly idleReads: ("after the busy work went on" | "while work was busy")[];
	readonly idleWaits: Map<string, Fiber.Fiber<void, unknown>>;
	readonly jobs: Map<string, Labelled>;
	readonly labels: Map<string, string>;
	readonly logs: { readonly level: string; readonly message: unknown; readonly runtime: string }[];
	readonly pollers: Map<string, (workerId: string) => void>;
	release: Release | undefined;
	readonly reported: string[];
	readonly revisionMarks: Map<string, number>;
	readonly runtimes: Map<string, Runtime>;
	seenBeforeCommit: unknown;
	readonly sql: SqlClient.SqlClient;
	readonly startups: Map<string, string>;
	readonly stopping: Map<string, Fiber.Fiber<void>>;
	readonly timeline: string[];
	readonly trace: ReturnType<typeof recordingTracer>;
	readonly url: string;
	readonly wakes: Map<string, string[]>;
	readonly work: WorkLog;
}

export function databaseEngine(url: string, sql: SqlClient.SqlClient): DatabaseEngine {
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
		changeWatches: new Map(),
		controllers: [],
		enqueuedAt: new Map(),
		gate: undefined,
		idleReads: [],
		idleWaits: new Map(),
		jobs: new Map(),
		labels,
		logs: [],
		pollers: new Map(),
		release: undefined,
		reported: [],
		revisionMarks: new Map(),
		runtimes: new Map(),
		seenBeforeCommit: undefined,
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
