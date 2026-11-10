// An application's notes module: its operations cover every wire form, a field rejection, a twin rejection class and a
// query whose policy reads the store. Paths are relative to the project; the kit writes package.json and tsconfig.json.
export const NOTES_PROJECT: Readonly<Record<string, string>> = {
	"src/modules/notes/archive.ts": `import { Schema } from "effect";

export class NoteMissing extends Schema.TaggedError<NoteMissing>()("NoteMissing", { message: Schema.String }) {}
`,
	"src/modules/notes/create.ts": `import { Effect, Schema } from "effect";
import { command } from "@shivaedev/contract/operation.ts";
import { NoteCard, NoteFields, notes, TitleTaken } from "#modules/notes/model.ts";
import { NotesStore } from "#modules/notes/store.ts";

export const Create = command("create", {
	invalidates: () => [notes.list],
	payload: NoteFields,
	*run(draft) {
		const { title } = yield* Schema.decodeUnknownEffect(NoteFields)(draft);
		const store = yield* NotesStore;
		if (title === "reserved") {
			return yield* new TitleTaken({ field: "title", message: "That title is reserved" });
		}
		const id = yield* store.insert(title).pipe(Effect.map((row) => row.id));
		return new NoteCard({ id, title });
	},
});
`,
	"src/modules/notes/get.ts": `import { Effect, Option, Schema } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import { NoteCard, NoteMissing, notes } from "#modules/notes/model.ts";
import { NotesStore } from "#modules/notes/store.ts";

export const Get = query("get", {
	payload: { id: Schema.Number },
	readPolicy: ({ id }) =>
		Effect.gen(function* () {
			const found = yield* (yield* NotesStore).find(id);
			if (Option.isNone(found)) {
				return yield* new NoteMissing({ message: "No such note" });
			}
			return true;
		}),
	reads: ({ id }) => [notes.item(id)],
	*run({ id }) {
		const found = yield* (yield* NotesStore).find(id);
		return Option.map(found, (row) => new NoteCard({ id: row.id, title: row.title }));
	},
});
`,
	"src/modules/notes/list.ts": `import { query } from "@shivaedev/contract/operation.ts";
import { notes } from "#modules/notes/model.ts";
import { NotesStore, type StoredNote } from "#modules/notes/store.ts";

interface ListedNote {
	readonly id: number;
	readonly title: string;
	readonly createdAt: Date;
	readonly tags: readonly string[];
	readonly summary?: string;
	pinned: boolean;
}

function listed(rows: readonly StoredNote[]): readonly ListedNote[] {
	return rows.map((row) => ({ createdAt: row.createdAt, id: row.id, pinned: false, tags: [], title: row.title }));
}

export const List = query("list", {
	reads: () => [notes.list],
	*run() {
		const store = yield* NotesStore;
		yield* store.owner;
		return listed(yield* store.rows);
	},
});
`,
	"src/modules/notes/model.ts": `import { Schema } from "effect";
import { RpcMiddleware } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { fieldRejection } from "@shivaedev/contract/rejection.ts";

export const notes = collection("notes", Schema.Number);
export const NoteFields = Schema.Struct({ title: Schema.String });
export class TitleTaken extends Schema.TaggedError<TitleTaken>()("TitleTaken", fieldRejection(NoteFields)) {}
export class NoteMissing extends Schema.TaggedError<NoteMissing>()("NoteMissing", { message: Schema.String }) {}
export class NoteCard extends Schema.Class<NoteCard>("NoteCard")({ id: Schema.Number, title: Schema.String }) {}
export class NotesCaller extends RpcMiddleware.Service<NotesCaller>()("fixture/NotesCaller") {}
`,
	"src/modules/notes/notes.ts": `import { defineModule } from "@shivaedev/contract/defineModule.ts";
import { notesWire } from "#generated/modules/notes/notes.ts";
import { Create } from "#modules/notes/create.ts";
import { Get } from "#modules/notes/get.ts";
import { List } from "#modules/notes/list.ts";
import { NotesCaller } from "#modules/notes/model.ts";
import { Remove } from "#modules/notes/remove.ts";
import { Stats } from "#modules/notes/stats.ts";
import { NotesStore } from "#modules/notes/store.ts";
import { Summary } from "#modules/notes/summary.ts";

export const Notes = defineModule({
	middleware: NotesCaller,
	name: "notes",
	operations: [List, Get, Create, Remove, Stats, Summary],
	requires: [NotesStore],
	wire: notesWire,
});
`,
	"src/modules/notes/remove.ts": `import { Schema } from "effect";
import { command } from "@shivaedev/contract/operation.ts";
import { notes } from "#modules/notes/model.ts";
import { NotesStore } from "#modules/notes/store.ts";

export const Remove = command("remove", {
	invalidates: ({ id }) => [notes.item(id), notes.list],
	payload: { id: Schema.Number },
	*run({ id }) {
		yield* (yield* NotesStore).remove(id);
	},
});
`,
	"src/modules/notes/stats.ts": `import { DateTime } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { notes } from "#modules/notes/model.ts";
import { NotesStore } from "#modules/notes/store.ts";

type Event = { readonly kind: "created"; readonly id: number } | { readonly kind: "deleted"; readonly id: number; readonly at: Date };

interface NoteStats {
	readonly count: number;
	readonly bytes: bigint;
	readonly words: Record<string, number>;
	readonly frozenWords: { readonly [word: string]: number };
	readonly status: "draft" | "published";
	readonly level: 1 | 2 | 3;
	readonly checkedAt: DateTime.Utc;
	readonly latest: string | null;
	readonly range: readonly [number, number];
	readonly pair: [string, number];
	readonly ids: number[];
	readonly events: readonly Event[];
	readonly nothing: null;
	readonly busy: boolean;
}

export const Stats = query("stats", {
	reads: () => [notes.list],
	*run() {
		const rows = yield* (yield* NotesStore).rows;
		if (rows.length > 999) {
			return yield* new ServiceUnavailable({ message: "Too many notes to count" });
		}
		const stats: NoteStats = {
			busy: rows.length > 9,
			bytes: 0n,
			checkedAt: DateTime.makeUnsafe(0),
			count: rows.length,
			events: [],
			frozenWords: {},
			ids: rows.map((row) => row.id),
			latest: rows[0]?.title ?? null,
			level: 1,
			nothing: null,
			pair: ["a", 1],
			range: [0, rows.length],
			status: "draft",
			words: {},
		};
		return stats;
	},
});
`,
	"src/modules/notes/store.ts": `import { Context, type Effect, type Option, Schema } from "effect";
import type { Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import type { NoteMissing } from "#modules/notes/archive.ts";

export interface StoredNote {
	readonly createdAt: Date;
	readonly id: number;
	readonly title: string;
}

export class StoreUnavailable extends Schema.TaggedError<StoreUnavailable>()("StoreUnavailable", { message: Schema.String }) {
	readonly isRetryable = true;
}

export class NotesStore extends Context.Service<
	NotesStore,
	{
		readonly find: (id: number) => Effect.Effect<Option.Option<StoredNote>, StoreUnavailable>;
		readonly insert: (title: string) => Effect.Effect<StoredNote, StoreUnavailable>;
		readonly owner: Effect.Effect<string, Unauthorized>;
		readonly remove: (id: number) => Effect.Effect<void, NoteMissing>;
		readonly rows: Effect.Effect<readonly StoredNote[]>;
	}
>()("fixture/NotesStore") {}
`,
	"src/modules/notes/summary.ts": `import { Schema } from "effect";
import { query } from "@shivaedev/contract/operation.ts";
import { QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import { notes } from "#modules/notes/model.ts";
import { NotesStore } from "#modules/notes/store.ts";

// The shape of the NoteCard Schema class, but a plain interface: the wire carries it as a struct.
interface NoteCardView {
	readonly id: number;
	readonly title: string;
}

function view(id: number, title: string): NoteCardView {
	return { id, title };
}

export const Summary = query("summary", {
	payload: { id: Schema.Number },
	reads: ({ id }) => [notes.item(id)],
	*run({ id }) {
		const rows = yield* (yield* NotesStore).rows;
		if (id < 0) {
			return yield* new QueryReadDenied({ message: "Not yours" });
		}
		return view(id, rows.find((row) => row.id === id)?.title ?? "");
	},
});
`,
};
