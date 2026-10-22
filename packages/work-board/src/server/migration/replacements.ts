import { states } from "#server/migration/oldVocabulary.ts";
import { sourceHeader } from "#server/migration/sourceHeader.ts";

function successorOf(data: Readonly<Record<string, unknown>>, ids: ReadonlySet<string>) {
	const named =
		data.superseded_by
		?? data.replaced_by
		?? (typeof data.next_action === "string"
			? /\b(?:Replaced|Superseded) by\s+`?(?<id>[a-zA-Z\d][a-zA-Z\d._-]*)/iu.exec(data.next_action)?.groups?.id
			: undefined);
	const successor = typeof named === "string" && !ids.has(named) ? named.replace(/\.$/u, "") : named;
	return { named, successor: typeof successor === "string" && ids.has(successor) ? successor : undefined };
}

export function replacements(files: readonly { readonly file: string; readonly source: string }[]) {
	const records = files.flatMap(({ file, source }) => {
		const header = sourceHeader(source);
		return header ? [{ data: header.doc.toJS(), file }] : [];
	});
	const ids = new Set(records.map(({ data }) => data.id));
	const replaced = new Set(
		records.flatMap(({ data }) =>
			(data.relationships ?? []).flatMap((link: { kind: string; target: string }) => (link.kind === "replaces" ? [link.target] : [])),
		),
	);
	const links = new Map<string, string[]>();
	const unresolved: string[] = [];
	for (const { data, file } of records) {
		if ((states[data.status] ?? data.status) !== "dropped" || typeof data.id !== "string") {
			continue;
		}
		const { named, successor } = successorOf(data, ids);
		if (named === undefined && replaced.has(data.id)) {
			continue;
		}
		if (successor === undefined) {
			unresolved.push(`${file}: ${data.id} -> ${typeof named === "string" ? named : "<not named>"}`);
		} else {
			links.set(successor, [...(links.get(successor) ?? []), data.id]);
		}
	}
	return { links, unresolved };
}
