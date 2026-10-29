import { Order } from "effect";
import type { Library, LibraryInput } from "#browser/navigation/library.ts";
import { sameStatus, statusOptions } from "#browser/views/statusLabel.ts";
import { fileUrl } from "#files/url.ts";
import { fleetRecords } from "#server/attention/inbox.ts";
import type { MarkdownFile } from "#server/files/list.ts";
import type { Snapshot } from "#server/search/snapshot.ts";
import { textMatches } from "#server/views/items.ts";

export function libraryData(files: readonly MarkdownFile[], snapshot: Snapshot, input: LibraryInput): Library {
	const records = fleetRecords(snapshot.model);
	const documents = new Map(snapshot.documents.map((document) => [document.file, document.parsed.fields]));
	const titles = new Map(snapshot.entries.filter((entry) => entry.kind === "document").map((entry) => [entry.file, entry.title]));
	const all = files
		.filter((file) => !documents.get(file.path)?.response)
		.map((file) => ({
			...file,
			href: fileUrl(file.path),
			kind: documents.get(file.path)?.kind ?? "document",
			status: documents.get(file.path)?.status ?? "",
			title: titles.get(file.path) ?? file.path,
		}));
	const visible = all.filter(
		(file) =>
			(input.showFleet || !records.has(file.path))
			&& (!input.kind || input.kind === file.kind)
			&& (!input.status || (file.status !== "" && sameStatus(input.status, file.status)))
			&& (!input.query || textMatches([file.title, documents.get(file.path)?.id], input.query)),
	);
	const prefix = input.folder ? `${input.folder}/` : "";
	const folders = new Map<string, number>();
	for (const file of visible) {
		if (!file.path.startsWith(prefix)) {
			continue;
		}
		const name = file.path.slice(prefix.length).split("/");
		if (name.length > 1 && name[0]) {
			folders.set(name[0], (folders.get(name[0]) ?? 0) + 1);
		}
	}
	return {
		files: visible
			.filter((file) => input.folder === undefined || (file.path.startsWith(prefix) && !file.path.slice(prefix.length).includes("/")))
			.toSorted((a, b) => a.title.localeCompare(b.title) || a.path.localeCompare(b.path)),
		fleetCount: all.filter((file) => records.has(file.path)).length,
		folders: [...folders].sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ count, name, path: `${prefix}${name}` })),
		kinds: [...new Set(all.map((file) => file.kind))].sort(Order.String),
		statuses: statusOptions(all.map((file) => file.status)),
	};
}
