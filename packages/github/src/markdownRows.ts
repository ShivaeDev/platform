export interface MarkdownRowsOptions {
	readonly byteLimit?: number;
	readonly header?: string;
}

export function renderRows(rows: readonly string[], { byteLimit = 60_000, header = "" }: MarkdownRowsOptions = {}): string {
	const encoder = new TextEncoder();
	const sizes = [0];
	for (const row of rows) {
		sizes.push((sizes.at(-1) ?? 0) + encoder.encode(row).byteLength + 1);
	}
	const headerBytes = encoder.encode(header).byteLength;
	function bodySize(kept: number) {
		return headerBytes + (kept > 0 ? (header === "" ? 0 : 1) + (sizes[kept] ?? 0) - 1 : 0);
	}
	function body(kept: number) {
		return [...(header === "" ? [] : [header]), ...rows.slice(0, kept)].join("\n");
	}
	if (bodySize(rows.length) <= byteLimit) {
		return body(rows.length);
	}
	for (let kept = rows.length - 1; kept >= 0; kept -= 1) {
		const notice = `and ${rows.length - kept} more`;
		const separator = kept > 0 || header !== "" ? "\n\n" : "";
		if (bodySize(kept) + separator.length + encoder.encode(notice).byteLength <= byteLimit) {
			return body(kept) + separator + notice;
		}
	}
	throw new RangeError("The byte limit must fit the header and omitted-row notice");
}
