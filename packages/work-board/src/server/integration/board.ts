import { type Changes, watchChanges } from "#server/files/changes.ts";
import { listMarkdown } from "#server/files/list.ts";
import { markdownPath } from "#server/files/markdownPath.ts";
import { areaDiagnostics } from "#server/metadata/areaDiagnostics.ts";
import { metadataModel } from "#server/metadata/model.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { type Snapshot, searchSnapshot } from "#server/search/snapshot.ts";

const snapshot: (
	root: string,
	home: string | undefined,
	changes: Changes,
	maintainer?: string,
) => Effect.Effect<Effect.Effect<Snapshot, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path>> = searchSnapshot;

export const board = {
	archiveSettled,
	areaDiagnostics,
	listMarkdown,
	loadSettled,
	markdownPath,
	metadataModel,
	metadataParse,
	searchSnapshot: snapshot,
	watchChanges,
} as const;

import type { Effect, FileSystem, Path, PlatformError } from "effect";
import { loadSettled } from "#server/archive/loadSettled.ts";
import { archiveSettled } from "#server/archive/settled.ts";
