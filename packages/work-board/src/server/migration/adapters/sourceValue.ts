import { isNode } from "yaml";
import { sourceHeader } from "./sourceHeader.ts";

export function sourceValue(source: string, field: string): string {
	const header = sourceHeader(source);
	const node = header?.doc.get(field, true);
	return header && isNode(node) && node.range ? source.slice(header.offset + node.range[0], header.offset + node.range[1]) : "<missing>";
}
