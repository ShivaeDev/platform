import { states } from "#server/migration/oldVocabulary.ts";
import { sourceHeader } from "#server/migration/sourceHeader.ts";

function successorsOf(data: Readonly<Record<string, unknown>>) {
	const named = data.superseded_by ?? data.replaced_by;
	if (typeof named === "string") {
		return [named];
	}
	if (typeof data.next_action !== "string") {
		return [];
	}
	const hint = /\b(?:Replaced by|Superseded by|Folded into)\s+(?<name>`?[a-zA-Z\d][a-zA-Z\d._-]*`?)(?<rest>.*)/iu.exec(data.next_action)?.groups;
	if (!hint?.name) {
		return [];
	}
	const names = [hint.name.replaceAll("`", "")];
	let rest = hint.rest ?? "";
	while (rest !== "") {
		const next = /^(?<separator>\s+and\s+|,\s*(?:and\s+)?|\s*&\s*)(?<name>`?[a-zA-Z\d][a-zA-Z\d._-]*`?)(?<rest>.*)/iu.exec(rest)?.groups;
		if (!next?.name) {
			break;
		}
		const name = next.name.replaceAll("`", "");
		if (
			next.separator?.startsWith(",")
			&& !next.name.startsWith("`")
			&& !/[._-][a-zA-Z\d]/u.test(name)
			&& !/^(?:\.?$|,|\s+(?:and\b|&))/iu.test(next.rest ?? "")
		) {
			break;
		}
		names.push(name);
		rest = next.rest ?? "";
	}
	return names;
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
