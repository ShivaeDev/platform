import { Option, Schema } from "effect";
import type { Snapshot } from "#search/snapshot.ts";
import { MAX_AGE, MAX_BYTES } from "./limits.ts";
import { Baseline } from "./schema.ts";

const JsonBaseline = Schema.fromJsonString(Baseline);
function byteLength(text: string): number {
	return new TextEncoder().encode(text).length;
}

export function readBaseline(raw: string | null, now: number) {
	if (raw === null) {
		return { baseline: undefined, discard: false, reason: "No previous snapshot. Start remembering changes to compare future source observations." };
	}
	if (byteLength(raw) > MAX_BYTES) {
		return { baseline: undefined, discard: true, reason: "Remembered snapshot exceeds 2 MiB; history is unavailable." };
	}
	const decoded = Schema.decodeUnknownOption(JsonBaseline, { onExcessProperty: "error" })(raw);
	if (Option.isNone(decoded)) {
		return { baseline: undefined, discard: true, reason: "Remembered snapshot is invalid or unsupported; history is unavailable." };
	}
	const elapsed = now - Date.parse(decoded.value.recordedAt);
	if (elapsed < 0) {
		return { baseline: undefined, discard: true, reason: "Remembered observation is in the future; history is unavailable." };
	}
	if (elapsed >= MAX_AGE) {
		return { baseline: undefined, discard: true, reason: "Remembered snapshot expired after 30 days; start again to establish a new baseline." };
	}
	return { baseline: decoded.value, discard: false, reason: "" };
}

export function observeBaseline(snapshot: Snapshot, now: number): string | undefined {
	if (snapshot.unavailable.length > 0) {
		return undefined;
	}
	const baseline: Baseline = {
		documents: snapshot.documents.map((document) => ({ file: document.file, source: (document.parsed.raw ?? "") + document.parsed.body })),
		recordedAt: new Date(now).toISOString(),
		version: 1,
	};
	const raw = Schema.encodeSync(JsonBaseline)(baseline);
	return byteLength(raw) <= MAX_BYTES ? raw : undefined;
}
