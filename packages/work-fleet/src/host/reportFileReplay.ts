import { Schema } from "effect";
import { applyReportPatch } from "#host/applyReportPatch.ts";
import type { Item } from "#providers/codexProtocol.ts";
import { REPORT_ATTACHMENT_DIRECTORY } from "#reportAttachments.ts";
import { REPORT_LIMITS, reportLimit } from "#reportLimits.ts";

const Change = Schema.Struct({
	diff: Schema.String,
	kind: Schema.Union([
		Schema.Struct({ type: Schema.Literal("add") }),
		Schema.Struct({ type: Schema.Literal("delete") }),
		Schema.Struct({ movePath: Schema.optional(Schema.NullOr(Schema.String)), type: Schema.Literal("update") }).pipe(
			Schema.encodeKeys({ movePath: "move_path" }),
		),
	]),
	path: Schema.String,
});
type Change = typeof Change.Type;
interface Replay {
	readonly contents: Map<string, string>;
	diffBytes: number;
	readonly names: Set<string>;
	readonly unavailable: Map<string, string>;
}
function attachmentName(path: string) {
	return path.startsWith(REPORT_ATTACHMENT_DIRECTORY) ? path.slice(REPORT_ATTACHMENT_DIRECTORY.length) : undefined;
}
function safeName(name: string) {
	return (
		!(name.includes("\\") || /\p{Cc}/u.test(name)) && name.split("/").every((part) => part !== "" && part !== "." && part !== ".." && part !== ".git")
	);
}
function update(state: Replay, change: Change, name: string, target: string) {
	const previous = state.contents.get(name);
	if (previous === undefined) {
		throw new Error("Attachment update has no retrievable add in this turn");
	}
	if (target !== name && state.contents.has(target)) {
		throw new Error("Attachment move overwrites another attachment");
	}
	const updated = applyReportPatch(previous, change.diff);
	state.contents.delete(name);
	state.contents.set(target, updated);
}
function applyChange(state: Replay, change: Change, name: string | undefined, target: string | undefined) {
	if (name === undefined || target === undefined || !safeName(name) || !safeName(target)) {
		throw new Error("Unsafe attachment path or move outside the attachment directory");
	}
	if (change.kind.type === "delete") {
		state.contents.delete(name);
	} else if (change.kind.type === "add") {
		if (state.contents.has(name)) {
			throw new Error("Attachment was added more than once without deletion");
		}
		state.contents.set(name, change.diff);
	} else {
		update(state, change, name, target);
	}
	state.unavailable.delete(name);
	state.unavailable.delete(target);
}
function replayChange(state: Replay, change: Change) {
	const name = attachmentName(change.path);
	const moved = change.kind.type === "update" ? change.kind.movePath : undefined;
	const target = moved == null ? name : attachmentName(moved);
	if (name === undefined && target === undefined) {
		return;
	}
	const label = target ?? name ?? "Attachment changes";
	state.names.add(label);
	if (state.names.size > REPORT_LIMITS.attachmentCount) {
		throw reportLimit("attachmentCount");
	}
	state.diffBytes += Buffer.byteLength(change.diff, "utf8");
	if (state.diffBytes > REPORT_LIMITS.diffBytes) {
		throw reportLimit("diffBytes");
	}
	try {
		applyChange(state, change, name, target);
	} catch (error) {
		if (name !== undefined) {
			state.contents.delete(name);
		}
		if (target !== undefined) {
			state.contents.delete(target);
		}
		state.unavailable.set(label, error instanceof Error ? error.message : "Attachment could not be reconstructed");
	}
}
export function reportFileReplay(items: readonly (typeof Item.Type)[]) {
	const state: Replay = { contents: new Map(), diffBytes: 0, names: new Set(), unavailable: new Map() };
	for (const item of items) {
		if (item.type !== "fileChange" || (item.status !== undefined && item.status !== "completed")) {
			continue;
		}
		const changes = Schema.decodeUnknownOption(Schema.Array(Change))(item.changes);
		if (changes._tag === "None") {
			state.unavailable.set("Attachment changes", "Codex returned malformed file changes");
			continue;
		}
		for (const change of changes.value) {
			replayChange(state, change);
		}
	}
	if ([...state.contents.values()].reduce((total, text) => total + Buffer.byteLength(text, "utf8"), 0) > REPORT_LIMITS.attachmentBytes) {
		throw reportLimit("attachmentBytes");
	}
	return state;
}
