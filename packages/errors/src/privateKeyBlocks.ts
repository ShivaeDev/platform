export function privateKeyBlocks(text: string): ReadonlyArray<readonly [number, number]> {
	// A header without its footer runs to the end: a cut excerpt keeps the header and loses the footer, and stopping there means no later header searches the rest of the text again.
	const header = /-----BEGIN (?<kind>(?:[A-Z0-9]+ )*PRIVATE KEY)-----/gu;
	const blocks: Array<readonly [number, number]> = [];
	for (let match = header.exec(text); match !== null; match = header.exec(text)) {
		const footer = `-----END ${match.groups?.kind ?? ""}-----`;
		const footerStart = text.indexOf(footer, header.lastIndex);
		const end = footerStart === -1 ? text.length : footerStart + footer.length;
		blocks.push([match.index, end]);
		header.lastIndex = end;
	}
	return blocks;
}
