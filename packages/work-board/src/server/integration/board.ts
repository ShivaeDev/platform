import { type Changes as InternalChanges, watchChanges } from "#server/files/changes.ts";
import { type MarkdownFile as InternalMarkdownFile, listMarkdown } from "#server/files/list.ts";
import { markdownPath } from "#server/files/markdownPath.ts";
import { areaDiagnostics } from "#server/metadata/areaDiagnostics.ts";
import {
	type MetadataDocument as InternalMetadataDocument,
	type MetadataModel as InternalMetadataModel,
	metadataModel,
} from "#server/metadata/model.ts";
import { type Diagnostic as InternalDiagnostic, type ParsedMetadata as InternalParsedMetadata, metadataParse } from "#server/metadata/parse.ts";
import { type Snapshot as InternalSnapshot, searchSnapshot } from "#server/search/snapshot.ts";
import { watchIndex } from "#server/search/watchIndex.ts";

export type Changes = InternalChanges;
export type MarkdownFile = InternalMarkdownFile;
export type MetadataDocument = InternalMetadataDocument;
export type MetadataModel = InternalMetadataModel;
export type Diagnostic = InternalDiagnostic;
export type ParsedMetadata = InternalParsedMetadata;
export type Snapshot = InternalSnapshot;

const snapshot: (
	root: string,
	home: string | undefined,
	changes: Changes,
	maintainer?: string,
) => Effect.Effect<Effect.Effect<Snapshot, PlatformError.PlatformError, FileSystem.FileSystem | Path.Path>> = searchSnapshot;

export const board = {
	areaDiagnostics,
	listMarkdown,
	markdownPath,
	metadataModel,
	metadataParse,
	searchSnapshot: snapshot,
	watchChanges,
	watchIndex,
} as const;

import type { Effect, FileSystem, Path, PlatformError } from "effect";
