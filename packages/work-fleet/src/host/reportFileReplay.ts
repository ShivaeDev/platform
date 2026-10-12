import { Effect, Schema } from "effect";
import { applyReportPatch } from "#host/applyReportPatch.ts";
import type { Item } from "#providers/codexProtocol.ts";
import { REPORT_ATTACHMENT_DIRECTORY } from "#reportAttachments.ts";
import { ReportFileFailure } from "#reportFileFailure.ts";
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
const update = Effect.fnUntraced(function* (state: Replay, change: Change, name: string, target: string) {
	const previous = state.contents.get(name);
	if (previous === undefined) {
		return yield* Effect.fail(new ReportFileFailure({ path: name, reason: "Attachment update has no retrievable add in this turn" }));
	}
	if (target !== name && state.contents.has(target)) {
		return yield* Effect.fail(new ReportFileFailure({ path: target, reason: "Attachment move overwrites another attachment" }));
	}
	const updated = yield* applyReportPatch(previous, change.diff, name);
	state.contents.delete(name);
	state.contents.set(target, updated);
});
const applyChange = Effect.fnUntraced(function* (state: Replay, change: Change, name: string | undefined, target: string | undefined) {
	if (name === undefined || target === undefined || !safeName(name) || !safeName(target)) {
		return yield* Effect.fail(
			new ReportFileFailure({ path: change.path, reason: "Unsafe attachment path or move outside the attachment directory" }),
		);
	}
	if (change.kind.type === "delete") {
		state.contents.delete(name);
	} else if (change.kind.type === "add") {
		if (state.contents.has(name)) {
			return yield* Effect.fail(new ReportFileFailure({ path: name, reason: "Attachment was added more than once without deletion" }));
		}
		state.contents.set(name, change.diff);
	} else {
		yield* update(state, change, name, target);
	}
	state.unavailable.delete(name);
	state.unavailable.delete(target);
});
const replayChange = Effect.fnUntraced(function* (state: Replay, change: Change) {
	const name = attachmentName(change.path);
	const moved = change.kind.type === "update" ? change.kind.movePath : undefined;
	const target = moved === null || moved === undefined ? name : attachmentName(moved);
	if (name === undefined && target === undefined) {
		return;
	}
	const label = target ?? name ?? change.path;
	state.names.add(label);
	if (state.names.size > REPORT_LIMITS.attachmentCount) {
		return yield* Effect.fail(new ReportFileFailure({ path: label, reason: reportLimit("attachmentCount").message }));
	}
	state.diffBytes += Buffer.byteLength(change.diff, "utf8");
	if (state.diffBytes > REPORT_LIMITS.diffBytes) {
		return yield* Effect.fail(new ReportFileFailure({ path: label, reason: reportLimit("diffBytes").message }));
	}
	yield* applyChange(state, change, name, target).pipe(
		Effect.catchTag("ReportFileFailure", (error) =>
			Effect.sync(() => {
				if (name !== undefined) {
					state.contents.delete(name);
				}
				if (target !== undefined) {
					state.contents.delete(target);
				}
				state.unavailable.set(label, error.reason);
			}),
		),
	);
});
export const reportFileReplay = Effect.fn("Fleet.reportFileReplay")(function* (items: readonly (typeof Item.Type)[]) {
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
			yield* replayChange(state, change);
		}
	}
	let bytes = 0;
	for (const [path, text] of state.contents) {
		bytes += Buffer.byteLength(text, "utf8");
		if (bytes > REPORT_LIMITS.attachmentBytes) {
			return yield* Effect.fail(new ReportFileFailure({ path, reason: reportLimit("attachmentBytes").message }));
		}
	}
	return state;
});
