import { Schema } from "effect";
import type { JobsQueue } from "./schemas.ts";

export type JobsEntry = JobsQueue | { readonly _tag: "ScheduleDefinition"; readonly name: string };

export type JobsPayload<TEntry extends JobsEntry> = [TEntry] extends [never]
	? typeof Schema.Never
	: TEntry extends JobsQueue
		? TEntry["schema"]
		: typeof Schema.Null;

export function jobsQueue<TEntry extends JobsEntry>(entry: TEntry): { readonly name: string; readonly schema: JobsPayload<TEntry> };
export function jobsQueue(entry: JobsEntry) {
	return { name: entry.name, schema: "schema" in entry ? entry.schema : Schema.Null };
}
