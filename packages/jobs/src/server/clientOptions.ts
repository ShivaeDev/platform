import type { ClientDatabase } from "#server/ClientDatabase.ts";

export interface ClientOptions {
	allowSchemaCaseVariant?: boolean;
	"application_name"?: string;

	backend?: "postgres" | "cockroachdb" | "yugabytedb" | "citus" | "pglite";
	bamIntervalSeconds?: number;

	clock?: Clock;
	clockMonitorIntervalSeconds?: number;
	connectionString?: string;
	connectionTimeoutMillis?: number;
	createSchema?: boolean;
	cronMonitorIntervalSeconds?: number;
	cronWorkerIntervalSeconds?: number;
	database?: string;
	db?: ClientDatabase;
	flowIntervalSeconds?: number;
	host?: string;
	instanceHeartbeatSeconds?: number;
	instanceName?: string;
	maintenanceIntervalSeconds?: number;
	max?: number;
	migrate?: boolean;
	monitorIntervalSeconds?: number;
	monitorVacuum?: boolean;
	notifyHeartbeatIntervalMs?: number;
	notifyHeartbeatTimeoutMs?: number;
	notifyKeepAliveInitialDelayMs?: number;
	openTelemetry?: { enabled?: boolean; propagateContext?: boolean };
	options?: string;
	password?: string | (() => string | Promise<string>);
	persistQueueStats?: boolean;
	persistWarnings?: boolean;
	port?: number;
	queueCacheIntervalSeconds?: number;
	queueStatRetentionDays?: number;

	registerInstance?: boolean;
	reindex?: boolean | ReindexOptions;
	reindexIntervalSeconds?: number;

	schedule?: boolean;
	schema?: string;
	ssl?: boolean | import("node:tls").ConnectionOptions;

	supervise?: boolean;
	superviseIntervalSeconds?: number;
	useListenNotify?: boolean;
	user?: string;
	warningQueueSize?: number;
	warningRetentionDays?: number;
	warningSlowQuerySeconds?: number;
}

export interface ReindexOptions extends IndexBloatOptions {
	force?: boolean;
	maxIndexBytes?: number;
}

export interface IndexBloatOptions {
	maxEntriesPerPage?: number;
	minPages?: number;
	minSizeRatio?: number;
}

export interface Clock {
	clearInterval: (handle: unknown) => void;
	clearTimeout: (handle: unknown) => void;
	now: () => number;
	setInterval: (fn: () => void, ms: number) => unknown;
	setTimeout: (fn: () => void, ms: number) => unknown;
}

export interface StopOptions {
	close?: boolean;
	graceful?: boolean;
	timeout?: number;
}
