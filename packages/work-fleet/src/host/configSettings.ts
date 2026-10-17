import { Equal, Schema } from "effect";
import { type FleetHost, HostConfig } from "#host/config.ts";
import type { AppliedConfig } from "#host/liveConfig.ts";
import { FleetViews } from "#model.ts";

// A running daemon applies these settings from an edited file; every other setting waits for a restart.
export const RELOADABLE_SETTINGS = [
	"areaMergeWaitMs",
	"backlog",
	"concurrency",
	"intervalSeconds",
	"launch",
	"quota",
	"stallMinutes",
	"worker.reviewerGuidance",
	"worker.workerGuidance",
] as const;

export const ConfigStatus = Schema.Struct({
	file: Schema.optional(Schema.String),
	loadedAt: Schema.Number,
	rejected: Schema.optional(Schema.Struct({ field: Schema.optional(Schema.String), message: Schema.String })),
	restartRequired: Schema.Array(Schema.String),
	settings: HostConfig,
});
export type ConfigStatus = typeof ConfigStatus.Type;

export const DaemonStatus = Schema.Struct({ ...FleetViews.fields, config: Schema.optional(ConfigStatus) });

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function setting(config: HostConfig, name: string): unknown {
	return name.split(".").reduce<unknown>((value, key) => (isRecord(value) ? value[key] : undefined), config);
}

function appliedSettings(host: FleetHost): HostConfig {
	return {
		areaMergeWaitMs: host.areaMergeWaitMs,
		backlog: host.backlog,
		...(host.cloud === undefined ? {} : { cloud: host.cloud }),
		concurrency: host.concurrency,
		database: { maxConnections: host.maxConnections },
		intervalSeconds: host.interval,
		launch: host.launch,
		...(host.local === undefined ? {} : { local: host.local }),
		namespace: host.namespace,
		provider: host.provider,
		quota: host.quota,
		repository: host.repository,
		...(host.result === undefined ? {} : { result: host.result }),
		stallMinutes: host.stallMinutes,
		...(host.worker === undefined ? {} : { worker: host.worker }),
	};
}

function write(target: Record<string, unknown>, [key, ...rest]: readonly string[], value: unknown) {
	if (key === undefined) {
		return;
	}
	if (rest.length > 0) {
		const child = target[key];
		if (isRecord(child)) {
			const copy = { ...child };
			write(copy, rest, value);
			target[key] = copy;
		}
		return;
	}
	if (value === undefined) {
		delete target[key];
	} else {
		target[key] = value;
	}
}

// A reloadable setting nested under a section that the running config lacks stays unapplied until a restart adds the section.
export function withReloadable(applied: HostConfig, next: HostConfig): Readonly<Record<string, unknown>> {
	const merged: Record<string, unknown> = { ...applied };
	for (const name of RELOADABLE_SETTINGS) {
		write(merged, name.split("."), setting(next, name));
	}
	return merged;
}

export function changedSettings(left: unknown, right: unknown, prefix = ""): readonly string[] {
	if (isRecord(left) && isRecord(right)) {
		return [...new Set([...Object.keys(left), ...Object.keys(right)])]
			.sort((first, second) => first.localeCompare(second))
			.flatMap((key) => changedSettings(left[key], right[key], prefix === "" ? key : `${prefix}.${key}`));
	}
	return Equal.equals(left, right) ? [] : [prefix];
}

export function configStatus({ host, loadedAt, rejected, restartRequired }: AppliedConfig): ConfigStatus {
	return {
		...(host.configFile === undefined ? {} : { file: host.configFile }),
		loadedAt,
		...(rejected === undefined
			? {}
			: { rejected: { ...(rejected.field === undefined ? {} : { field: rejected.field }), message: rejected.message } }),
		restartRequired,
		settings: appliedSettings(host),
	};
}

export function renderConfig(config: ConfigStatus): string {
	const applying = RELOADABLE_SETTINGS.flatMap((name) => {
		const value = setting(config.settings, name);
		return value === undefined ? [] : [`${name} ${typeof value === "object" ? JSON.stringify(value) : String(value)}`];
	});
	const rejected = config.rejected;
	return [
		`Config loaded ${new Date(config.loadedAt).toISOString()}${config.file === undefined ? "" : ` from ${config.file}`}`,
		`  provider ${config.settings.provider}, ${applying.join(", ")}`,
		...(config.restartRequired.length === 0 ? [] : [`  Restart to apply: ${config.restartRequired.join(", ")}`]),
		...(rejected === undefined
			? []
			: [`  Rejected edit${rejected.field === undefined ? "" : ` of ${rejected.field}`}, still applying the config above: ${rejected.message}`]),
	].join("\n");
}
