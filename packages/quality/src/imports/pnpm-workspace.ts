const KEY = /^packages\s*:/u;

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

function flowList(lines: readonly string[]): readonly string[] {
	const text = lines.map(withoutComment).join(" ").trim();
	const close = text.lastIndexOf("]");
	if (close === -1) {
		throw failure("the packages list never closes");
	}
	if (text.slice(close + 1).trim() !== "") {
		throw failure(`cannot read "${text}" in packages`);
	}
	return text
		.slice(1, close)
		.split(",")
		.filter((entry) => entry.trim() !== "")
		.map(scalar);
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
		const flow = [rest, ...lines.slice(start + 1)];
		const end = flow.findIndex((line) => withoutComment(line).includes("]"));
		return flowList(end === -1 ? flow : flow.slice(0, end + 1));
	}
	if (rest !== "") {
		throw failure(`cannot read "${rest}" in packages`);
	}
	return blockList(lines.slice(start + 1));
}
