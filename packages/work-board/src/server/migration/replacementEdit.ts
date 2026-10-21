import { isSeq } from "yaml";
import type { sourceHeader } from "./sourceHeader.ts";

export function replacementEdit(header: NonNullable<ReturnType<typeof sourceHeader>>, source: string, targets: readonly string[]) {
	const links = header.doc.get("relationships", true);
	if (!(isSeq(links) && links.range)) {
		return undefined;
	}
	const { offset } = header;
	if (links.flow) {
		const at = offset + links.range[1] - 1;
		return {
			end: at,
			start: at,
			text: `${links.items.length > 0 ? ", " : ""}${targets.map((target) => JSON.stringify({ kind: "replaces", target })).join(", ")}`,
		};
	}
	const newline = source.includes("\r\n") ? "\r\n" : "\n";
	const at = offset + links.range[1];
	const first = offset + links.range[0];
	const indent = source.slice(source.lastIndexOf("\n", first) + 1, first);
	const text = targets.map((target) => `${indent}- kind: replaces${newline}${indent}  target: ${JSON.stringify(target)}${newline}`).join("");
	return { end: at, start: at, text: `${source[at - 1] === "\n" ? "" : newline}${text}` };
}
