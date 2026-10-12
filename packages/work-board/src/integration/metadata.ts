import type { Metadata } from "#metadata/schema.ts";

export interface Diagnostic {
	readonly field?: string;
	readonly line: number;
	readonly message: string;
}

export interface ParsedMetadata {
	readonly body: string;
	readonly bodyLine: number;
	readonly diagnostics: readonly Diagnostic[];
	readonly fields: Metadata;
	readonly lines: Readonly<Record<string, number>>;
	readonly raw?: string;
}

export interface MetadataDocument {
	readonly file: string;
	readonly links?: readonly string[];
	readonly modified?: number;
	readonly parsed: ParsedMetadata;
}

export interface MetadataModel {
	readonly diagnostics: ReadonlyMap<string, readonly Diagnostic[]>;
	readonly documents: readonly MetadataDocument[];
	readonly ids: ReadonlyMap<string, readonly MetadataDocument[]>;
	readonly rootFile: string | undefined;
	readonly unavailable: readonly string[];
}
