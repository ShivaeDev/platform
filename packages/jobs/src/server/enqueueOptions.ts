import type { ClientDatabase } from "#server/ClientDatabase.ts";
import type { RetryOptions } from "#server/queueOptions.ts";

export interface EnqueueOptions extends RetryOptions {
	readonly db?: ClientDatabase;
	readonly deadLetter?: string;
	readonly group?: { readonly id: string; readonly tier?: string };
	readonly id?: string;
	readonly priority?: number;
	readonly singletonKey?: string;
	readonly singletonNextSlot?: boolean;
	readonly singletonSeconds?: number;
	readonly startAfter?: number | string | Date;
}

export interface ScheduleOptions extends EnqueueOptions {
	readonly key?: string;
	readonly missed?: "skip" | "once";
	readonly tz?: string;
}
