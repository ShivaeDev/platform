import type { SnapshotSummary } from "vitest";
import type { Snapshot } from "#internal/snapshot.ts";

export function mergeSnapshotSummary(previous: Snapshot["summary"], current: SnapshotSummary): SnapshotSummary {
	return {
		added: previous.added + current.added,
		didUpdate: previous.didUpdate || current.didUpdate,
		failure: previous.failure || current.failure,
		filesAdded: previous.filesAdded + current.filesAdded,
		filesRemoved: previous.filesRemoved + current.filesRemoved,
		filesRemovedList: [...previous.filesRemovedList, ...current.filesRemovedList],
		filesUnmatched: previous.filesUnmatched + current.filesUnmatched,
		filesUpdated: previous.filesUpdated + current.filesUpdated,
		matched: previous.matched + current.matched,
		total: previous.total + current.total,
		unchecked: previous.unchecked + current.unchecked,
		uncheckedKeysByFile: [...previous.uncheckedKeysByFile.map((file) => ({ ...file, keys: [...file.keys] })), ...current.uncheckedKeysByFile],
		unmatched: previous.unmatched + current.unmatched,
		updated: previous.updated + current.updated,
	};
}
