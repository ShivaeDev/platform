const KEY = /^(?:packages|"packages"|'packages')\s*:/u;

const ITEM = "-";

const SPACE = /\s/u;

const LINE_BREAK = /\r?\n/u;

function failure(problem: string, cause?: unknown): Error {
	return new Error(`pnpm-workspace.yaml: ${problem}`, { cause });
}

function withoutComment(line: string): string {
	let quote: string | undefined;
	for (let index = 0; index < line.length; index += 1) {
		const char = line[index];
		if (quote !== undefined) {
			quote = char === quote ? undefined : quote;
		} else if (char === '"' || char === "'") {
			quote = char;
		} else if (char === "#" && (index === 0 || SPACE.test(line[index - 1] ?? ""))) {
			return line.slice(0, index).trimEnd();
		}
	}
	return line.trimEnd();
}

function scalar(raw: string): string {
	const value = raw.trim();
	if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
		try {
			return String(JSON.parse(value));
		} catch (error) {
			throw failure(`cannot read "${value}" in packages`, error);
		}
	}
	if (value.startsWith("'") && value.endsWith("'") && value.length > 1) {
		return value.slice(1, -1).replaceAll("''", "'");
	}
	if (value === "" || value.includes(": ") || value.endsWith(":") || ["[", "{", "'", '"'].some((opening) => value.startsWith(opening))) {
		throw failure(`cannot read "${value}" in packages`);
	}
	return value;
}

const FLOW_INDICATOR = /[{}[\]]/u;

interface FlowScan {
	current: string;
	readonly entries: string[];
	quote: string | undefined;
}

function flowScalar(raw: string): string {
	const value = raw.trim();
	const quoted = value.startsWith('"') || value.startsWith("'");
	if (!quoted && FLOW_INDICATOR.test(value)) {
		throw failure(`cannot read "${value}" in packages; quote a pattern that holds { } [ ] or ,`);
	}
	return scalar(value);
}

function closed(scan: FlowScan, rest: string): readonly string[] {
	if (rest.trim() !== "") {
		throw failure(`cannot read "${rest.trim()}" after the packages list`);
	}
	return [...scan.entries, scan.current].filter((entry) => entry.trim() !== "").map(flowScalar);
}

function scanned(scan: FlowScan, char: string): "close" | undefined {
	if (scan.quote !== undefined) {
		scan.quote = char === scan.quote ? undefined : scan.quote;
	} else if (char === "]") {
		return "close";
	} else if (char === ",") {
		scan.entries.push(scan.current);
		scan.current = "";
		return undefined;
	} else if (char === '"' || char === "'") {
		scan.quote = char;
	}
	scan.current += char;
	return undefined;
}

function flowList(lines: readonly string[]): readonly string[] {
	const scan: FlowScan = { current: "", entries: [], quote: undefined };
	for (const [number, line] of lines.map(withoutComment).entries()) {
		for (let index = number === 0 ? 1 : 0; index < line.length; index += 1) {
			if (scanned(scan, line[index] ?? "") === "close") {
				return closed(scan, line.slice(index + 1));
			}
		}
		scan.current += " ";
	}
	throw failure("the packages list never closes");
}

function blockList(lines: readonly string[]): readonly string[] {
	const patterns: string[] = [];
	for (const line of lines.map(withoutComment)) {
		const trimmed = line.trim();
		if (trimmed === "") {
			continue;
		}
		const item = trimmed === ITEM || trimmed.startsWith(`${ITEM} `);
		if (!(item || line.startsWith(" ") || line.startsWith("\t"))) {
			break;
		}
		if (!item) {
			throw failure(`cannot read "${trimmed}" in packages`);
		}
		patterns.push(scalar(trimmed.slice(ITEM.length)));
	}
	return patterns;
}

export function pnpmWorkspacePatterns(text: string): readonly string[] {
	const lines = text.split(LINE_BREAK);
	const start = lines.findIndex((line) => KEY.test(line));
	if (start === -1) {
		return [];
	}
	const rest = withoutComment(lines[start] ?? "")
		.replace(KEY, "")
		.trim();
	if (rest.startsWith("[")) {
		return flowList([rest, ...lines.slice(start + 1)]);
	}
	if (rest !== "") {
		throw failure(`cannot read "${rest}" in packages`);
	}
	return blockList(lines.slice(start + 1));
}
