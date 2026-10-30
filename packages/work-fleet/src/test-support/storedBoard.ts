import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Order, Schema } from "effect";

const Location = Schema.fromJsonString(Schema.Struct({ file: Schema.String, id: Schema.String }));

function archived(root: string) {
	const catalogue = join(root, ".board-settled/catalogue.jsonl");
	return existsSync(catalogue)
		? readFileSync(catalogue, "utf8")
				.split("\n")
				.filter(Boolean)
				.map((line) => Schema.decodeUnknownSync(Location)(line))
		: [];
}

export function storedBoardPath(root: string, file: string) {
	const active = join(root, file);
	if (existsSync(active)) {
		return active;
	}
	const record = archived(root).find((entry) => entry.file === file);
	return record ? join(root, ".board-settled", `${record.id}.md`) : active;
}

export function storedBoardSource(root: string, file: string) {
	return readFileSync(storedBoardPath(root, file), "utf8");
}

export function storedBoardResponses(root: string) {
	const directory = join(root, "responses");
	const active = (existsSync(directory) ? readdirSync(directory) : []).filter((file) => file.endsWith(".md"));
	const saved = archived(root).filter(
		(record) => record.file.startsWith("responses/") && existsSync(join(root, ".board-settled", `${record.id}.md`)),
	);
	return [...new Set([...active, ...saved.map((record) => record.file.slice("responses/".length))])].sort(Order.String);
}
