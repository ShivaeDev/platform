import { type Changes as InternalChanges, watchChanges } from "#server/files/changes.ts";
import { type MarkdownFile as InternalMarkdownFile, listMarkdown } from "#server/files/list.ts";
import { markdownPath } from "#server/files/markdownPath.ts";
import {
	type MetadataDocument as InternalMetadataDocument,
	type MetadataModel as InternalMetadataModel,
	metadataModel,
} from "#server/metadata/model.ts";
import { type Diagnostic as InternalDiagnostic, type ParsedMetadata as InternalParsedMetadata, metadataParse } from "#server/metadata/parse.ts";
import { type Snapshot as InternalSnapshot, searchSnapshot } from "#server/search/snapshot.ts";

export type Changes = InternalChanges;
export type MarkdownFile = InternalMarkdownFile;
export type MetadataDocument = InternalMetadataDocument;
export type MetadataModel = InternalMetadataModel;
export type Diagnostic = InternalDiagnostic;
export type ParsedMetadata = InternalParsedMetadata;
export type Snapshot = InternalSnapshot;

export const board = {
	listMarkdown,
	markdownPath,
	metadataModel,
	metadataParse,
	searchSnapshot,
	watchChanges,
} as const;
