export const WIDTH = 120;

export function wrap(text: string, { first = "", rest = "" }: { readonly first?: string; readonly rest?: string } = {}): string[] {
	const lines: string[] = [];
	let line = first;
	for (const word of text.split(" ")) {
		const prefix = lines.length === 0 ? first : rest;
		if (line.length > prefix.length && line.length + 1 + word.length > WIDTH) {
			lines.push(line);
			line = `${rest}${word}`;
		} else {
			line = line.length > prefix.length ? `${line} ${word}` : `${line}${word}`;
		}
	}
	return [...lines, line];
}

export function explained(what: string, help: string): string {
	return [...wrap(what, { rest: "  " }), ...wrap(help, { first: "help: ", rest: "      " })].join("\n");
}

function members(json: string): string[] {
	const value: unknown = JSON.parse(json);
	if (Array.isArray(value)) {
		return value.map((item) => JSON.stringify(item));
	}
	return typeof value === "object" && value !== null
		? Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}:${JSON.stringify(item)}`)
		: [json];
}

export function wrapJson(json: string): string[] {
	const [open, close] = json.startsWith("[") ? ["[", "]"] : ["{", "}"];
	const pieces = members(json);
	if (pieces.length < 2) {
		return [json];
	}
	const lines: string[] = [];
	let line = open;
	for (const [index, piece] of pieces.entries()) {
		const next = `${piece}${index === pieces.length - 1 ? close : ","}`;
		if (line.length > 1 && line.length + next.length > WIDTH) {
			lines.push(line);
			line = next;
		} else {
			line += next;
		}
	}
	return [...lines, line];
}
