import { Schema } from "effect";
import { Baseline } from "#history/schema.ts";

export const OBSERVED = Date.parse("2026-10-05T12:00:00Z");
export function historyFixture(files: Readonly<Record<string, string>>, now = OBSERVED): Baseline {
	return { documents: Object.entries(files).map(([file, source]) => ({ file, source })), recordedAt: new Date(now).toISOString(), version: 1 };
}
export function baselineJson(files: Readonly<Record<string, string>>, now = OBSERVED): string {
	return Schema.encodeSync(Schema.fromJsonString(Baseline))(historyFixture(files, now));
}
