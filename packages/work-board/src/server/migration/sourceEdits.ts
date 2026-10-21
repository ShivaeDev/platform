import { isScalar } from "yaml";
import { replacementEdit } from "./replacementEdit.ts";
import type { sourceHeader } from "./sourceHeader.ts";

type Header = NonNullable<ReturnType<typeof sourceHeader>>;
export function sourceEdits(source: string, header: Header) {
	const { doc, contents, offset, end } = header;
	const edits: { start: number; end: number; text: string }[] = [];
	const additions: string[] = [];
	const newline = source.includes("\r\n") ? "\r\n" : "\n";
	let fields = 0;
	function set(field: string, value: string) {
		const node = doc.get(field, true);
		if (isScalar(node) && node.range) {
			if (node.value === value) {
				return;
			}
			edits.push({ end: offset + node.range[1], start: offset + node.range[0], text: JSON.stringify(value) });
		} else {
			additions.push(`${field}: ${JSON.stringify(value)}`);
		}
		fields += 1;
	}
	function remove(field: string) {
		const pair = contents.items.find((item) => isScalar(item.key) && item.key.value === field);
		if (!(pair && isScalar(pair.key) && pair.key.range && isScalar(pair.value) && pair.value.range)) {
			return;
		}
		let start = offset + pair.key.range[0];
		let to = offset + pair.value.range[1];
		if (contents.flow) {
			const after = /^\s*,/u.exec(source.slice(to, end));
			if (after) {
				to += after[0].length;
			} else {
				const before = /,\s*$/u.exec(source.slice(offset, start));
				if (before) {
					start = offset + before.index;
				}
			}
		}
		edits.push({ end: to, start, text: "" });
		fields += 1;
	}
	function rename(field: string, name: string) {
		const key = contents.items.find((item) => isScalar(item.key) && item.key.value === field)?.key;
		if (isScalar(key) && key.range) {
			edits.push({ end: offset + key.range[1], start: offset + key.range[0], text: JSON.stringify(name) });
			fields += 1;
		}
	}
	function replaces(targets: readonly string[]) {
		if (targets.length === 0) {
			return;
		}
		const edit = replacementEdit(header, source, targets);
		if (edit) {
			edits.push(edit);
		} else {
			additions.push(`relationships: ${JSON.stringify(targets.map((target) => ({ kind: "replaces", target })))}`);
		}
		fields += 1;
	}
	function finish() {
		if (additions.length > 0) {
			const at = contents.flow && contents.range ? offset + contents.range[1] - 1 : end;
			const text = contents.flow ? `, ${additions.join(", ")}` : `${additions.join(newline)}${newline}`;
			edits.push({ end: at, start: at, text });
		}
		let migrated = source;
		for (const edit of edits.toSorted((a, b) => b.start - a.start)) {
			migrated = migrated.slice(0, edit.start) + edit.text + migrated.slice(edit.end);
		}
		return { fields, source: migrated };
	}
	return { finish, remove, rename, replaces, set };
}
