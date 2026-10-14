import { isAlias, isMap, isScalar, parseDocument } from "yaml";

interface Edit {
	readonly end: number;
	readonly start: number;
	readonly text: string;
}

function scalarEdit(header: string, node: unknown, value: string, encoded: string): Edit | false | undefined {
	if (!(isScalar(node) || isAlias(node)) || node.range === undefined || node.range === null) {
		return false;
	}
	if (isScalar(node) && node.value === value) {
		return;
	}
	const [start, end] = node.range;
	const token = node.srcToken;
	const ending =
		token?.type === "block-scalar"
			? token.props
					.slice(1)
					.map((part) => ("source" in part ? part.source : ""))
					.join("")
			: "";
	const spacing = header[start - 1] === ":" ? " " : "";
	return { end, start, text: `${spacing}${encoded}${ending}` };
}

export function completionFields(header: string, nextAction: string, newline: string): readonly Edit[] | undefined {
	const document = parseDocument(header, { keepSourceTokens: true });
	const mapping = document.contents;
	if (document.errors.length > 0 || document.warnings.length > 0 || !isMap(mapping) || mapping.range === undefined) {
		return;
	}
	const edits: Edit[] = [];
	const missing: string[] = [];
	for (const [key, value, encoded] of [
		["status", "done", "done"],
		["next_action", nextAction, JSON.stringify(nextAction)],
	] as const) {
		const pair = mapping.items.find((item) => isScalar(item.key) && item.key.value === key);
		if (pair === undefined) {
			missing.push(`${key}: ${encoded}`);
			continue;
		}
		const edit = scalarEdit(header, pair.value, value, encoded);
		if (edit === false) {
			return;
		}
		if (edit !== undefined) {
			edits.push(edit);
		}
	}
	if (missing.length > 0) {
		edits.push(missingEdit(header, mapping.flow === true, mapping.range[1], mapping.items.length, missing, newline));
	}
	return edits;
}

function missingEdit(header: string, flow: boolean, end: number, count: number, missing: readonly string[], newline: string): Edit {
	const start = flow ? end - 1 : header.length;
	const separator = count > 0 && !header.slice(0, start).trimEnd().endsWith(",") ? ", " : "";
	const text = flow ? `${separator}${missing.join(", ")}` : `${missing.join(newline)}${newline}`;
	return { end: start, start, text };
}
