import type { Effect } from "effect";

export interface UserExportTable {
	readonly schema: string;
	readonly table: string;
}

export interface UserExportReference extends UserExportTable {
	readonly column: string;
}

export interface UserDataExport {
	readonly export: (userId: string) => Effect.Effect<unknown, unknown, unknown>;
	readonly tables: readonly UserExportTable[];
}
