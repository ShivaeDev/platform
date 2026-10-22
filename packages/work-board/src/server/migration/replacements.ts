import { states } from "#server/migration/oldVocabulary.ts";
import { sourceHeader } from "#server/migration/sourceHeader.ts";

function successorsOf(data: Readonly<Record<string, unknown>>) {
	const named = data.superseded_by ?? data.replaced_by;
	if (typeof named === "string") {
		return [named];
	}
	const hint =
		typeof data.next_action === "string"
			? /\b(?:Replaced by|Superseded by|Folded into)\s+(?<names>`?[a-zA-Z\d][a-zA-Z\d._-]*`?(?:(?:\s+and\s+|,\s*(?:and\s+)?|\s*&\s*)`?[a-zA-Z\d][a-zA-Z\d._-]*`?)*)/iu.exec(
					data.next_action,
				)?.groups?.names
			: undefined;
	return hint?.match(/[a-zA-Z\d][a-zA-Z\d._-]*/gu)?.filter((name) => name.toLowerCase() !== "and") ?? [];
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
	const requests = records.flatMap(({ data, file }) => {
		if (!["dropped", "done"].includes(states[data.status] ?? data.status) || typeof data.id !== "string") {
			return [];
		}
		const names = successorsOf(data);
		return names.length > 0 || ((states[data.status] ?? data.status) === "dropped" && !replaced.has(data.id)) ? [{ file, id: data.id, names }] : [];
	});
	for (const { file, id, names } of requests) {
		if (names.length === 0) {
			unresolved.push(`${file}: ${id} -> <not named>`);
		}
		for (const named of names) {
			const successor = ids.has(named) ? named : named.replace(/\.$/u, "");
			if (ids.has(successor)) {
				links.set(successor, [...new Set([...(links.get(successor) ?? []), id])]);
			} else {
				unresolved.push(`${file}: ${id} -> ${named}`);
			}
		}
	}
	return { links, unresolved };
}
