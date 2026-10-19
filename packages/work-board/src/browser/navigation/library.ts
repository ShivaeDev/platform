import { Option, Schema } from "effect";

export const LibraryInput = {
	folder: Schema.optional(Schema.String),
	kind: Schema.optional(Schema.String),
	query: Schema.optional(Schema.String),
	showFleet: Schema.optional(Schema.Boolean),
	status: Schema.optional(Schema.String),
};
export type LibraryInput = Schema.Struct.Type<typeof LibraryInput>;
export const LibraryFile = Schema.Struct({
	href: Schema.String,
	kind: Schema.String,
	modified: Schema.Number,
	path: Schema.String,
	status: Schema.String,
	title: Schema.String,
});
export type LibraryFile = typeof LibraryFile.Type;
export const Library = Schema.Struct({
	files: Schema.Array(LibraryFile),
	fleetCount: Schema.Number,
	folders: Schema.Array(Schema.Struct({ count: Schema.Number, name: Schema.String, path: Schema.String })),
	kinds: Schema.Array(Schema.String),
	statuses: Schema.Array(Schema.String),
});
export type Library = typeof Library.Type;

const LibraryView = Schema.Literals(["recently-changed", "titles", "folders"]);
export type LibraryView = typeof LibraryView.Type;
export interface LibraryState {
	readonly fleet: boolean;
	readonly kind: string;
	readonly query: string;
	readonly status: string;
	readonly view: LibraryView;
}

export function libraryState(url: string): LibraryState {
	const params = new URL(url, "http://127.0.0.1").searchParams;
	return {
		fleet: params.get("fleet") === "1",
		kind: params.get("kind") ?? "",
		query: (params.get("q") ?? "").slice(0, 200),
		status: params.get("status") ?? "",
		view: Option.getOrElse(Schema.decodeUnknownOption(LibraryView)(params.get("view")), () => "recently-changed"),
	};
}

export function libraryInput(state: LibraryState): LibraryInput {
	return {
		...(state.view === "folders" ? { folder: "" } : {}),
		...(state.kind ? { kind: state.kind } : {}),
		...(state.query.trim() ? { query: state.query.trim() } : {}),
		...(state.fleet ? { showFleet: true } : {}),
		...(state.status ? { status: state.status } : {}),
	};
}

export function libraryUrl(state: LibraryState, changes: Partial<LibraryState> = {}): string {
	const next = { ...state, ...changes };
	const params = new URLSearchParams({ view: next.view });
	for (const [key, value] of Object.entries({ fleet: next.fleet ? "1" : "", kind: next.kind, q: next.query, status: next.status })) {
		if (value) {
			params.set(key, value);
		}
	}
	return `/_board/library?${params}`;
}
