import { isMap, isNode, isScalar, isSeq, type LineCounter, type Node, type YAMLMap } from "yaml";

function recordMap(node: YAMLMap, field: string, counter: LineCounter, lines: Record<string, number>) {
	for (const pair of node.items) {
		if (!isScalar(pair.key) || typeof pair.key.value !== "string") {
			continue;
		}
		const key = field ? `${field}.${pair.key.value}` : pair.key.value;
		visit(pair.value, key, counter, lines);
		if (pair.key.range) {
			lines[key] = counter.linePos(pair.key.range[0]).line + 1;
		}
	}
}
function visit(value: unknown, field: string, counter: LineCounter, lines: Record<string, number>) {
	if (!isNode(value)) {
		return;
	}
	if (value.range && field) {
		lines[field] = counter.linePos(value.range[0]).line + 1;
	}
	if (isMap(value)) {
		recordMap(value, field, counter, lines);
	} else if (isSeq(value)) {
		value.items.forEach((item, index) => {
			visit(item, `${field}.${index}`, counter, lines);
		});
	}
}
export function metadataLocations(node: Node | null, counter: LineCounter): Readonly<Record<string, number>> {
	const lines: Record<string, number> = {};
	visit(node, "", counter, lines);
	return lines;
}
