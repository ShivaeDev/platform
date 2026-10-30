import { Effect, FileSystem, Path, Schema } from "effect";

const Record = Schema.Struct({
	file: Schema.String,
	id: Schema.String,
	item: Schema.String,
	modified: Schema.Number,
	revision: Schema.String,
	targets: Schema.Array(Schema.String),
});
const CatalogueEntry = Schema.fromJsonString(Record);
export type SettledRecord = typeof Record.Type;

export const readCatalogue = Effect.fn("WorkBoard.readCatalogue")(function* (root: string) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const file = path.join(root, ".board-settled/catalogue.jsonl");
	if (!(yield* fs.exists(file))) {
		return [];
	}
	const lines = (yield* fs.readFileString(file)).split("\n").filter((line) => line.length > 0);
	const records = yield* Effect.forEach(lines, (line) => Schema.decodeUnknownEffect(CatalogueEntry)(line).pipe(Effect.orDie));
	return [...new Map(records.map((record) => [record.id, record])).values()];
});

export const appendCatalogue = Effect.fn("WorkBoard.appendCatalogue")(function* (root: string, records: readonly SettledRecord[]) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const file = path.join(root, ".board-settled/catalogue.jsonl");
	yield* fs.makeDirectory(path.dirname(file), { recursive: true });
	for (const record of records) {
		yield* fs.writeFileString(file, `${JSON.stringify(record)}\n`, { flag: "a" });
	}
});

export function recordPath(record: { readonly id: string }) {
	return `.board-settled/${record.id}.md`;
}
