import { Data, Result, Schema } from "effect";

export class PnpmWorkspaceFailure extends Data.TaggedError("PnpmWorkspaceFailure")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

function keyPattern(key: string): RegExp {
	return new RegExp(`^(?:${key}|"${key}"|'${key}')\\s*:`, "u");
}

const ITEM = "-";

const SPACE = /\s/u;

const LINE_BREAK = /\r?\n/u;

function failure(problem: string, cause?: unknown): PnpmWorkspaceFailure {
	return new PnpmWorkspaceFailure({ cause, message: `pnpm-workspace.yaml: ${problem}` });
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

function scalar(raw: string, key: string): Result.Result<string, PnpmWorkspaceFailure> {
	const value = raw.trim();
	if (value.startsWith('"') && value.endsWith('"') && value.length > 1) {
		return Result.mapError(Schema.decodeUnknownResult(Schema.fromJsonString(Schema.String))(value), (error) =>
			failure(`cannot read "${value}" in ${key}`, error),
		);
	}
	if (value.startsWith("'") && value.endsWith("'") && value.length > 1) {
		return Result.succeed(value.slice(1, -1).replaceAll("''", "'"));
	}
	if (value === "" || value.includes(": ") || value.endsWith(":") || ["[", "{", "'", '"'].some((opening) => value.startsWith(opening))) {
		return Result.fail(failure(`cannot read "${value}" in ${key}`));
	}
	return Result.succeed(value);
}

const FLOW_INDICATOR = /[{}[\]]/u;

interface FlowScan {
	current: string;
	readonly entries: string[];
	quote: string | undefined;
}

function flowScalar(raw: string, key: string): Result.Result<string, PnpmWorkspaceFailure> {
	const value = raw.trim();
	const quoted = value.startsWith('"') || value.startsWith("'");
	if (!quoted && FLOW_INDICATOR.test(value)) {
		return Result.fail(failure(`cannot read "${value}" in ${key}; quote a pattern that holds { } [ ] or ,`));
	}
	return scalar(value, key);
}

function closed(scan: FlowScan, rest: string, key: string): Result.Result<readonly string[], PnpmWorkspaceFailure> {
	if (rest.trim() !== "") {
		return Result.fail(failure(`cannot read "${rest.trim()}" after the ${key} list`));
	}
	return Result.all([...scan.entries, scan.current].filter((entry) => entry.trim() !== "").map((entry) => flowScalar(entry, key)));
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

function flowList(lines: readonly string[], key: string): Result.Result<readonly string[], PnpmWorkspaceFailure> {
	const scan: FlowScan = { current: "", entries: [], quote: undefined };
	for (const [number, line] of lines.map(withoutComment).entries()) {
		for (let index = number === 0 ? 1 : 0; index < line.length; index += 1) {
			if (scanned(scan, line[index] ?? "") === "close") {
				return closed(scan, line.slice(index + 1), key);
			}
		}
		scan.current += " ";
	}
	return Result.fail(failure(`the ${key} list never closes`));
}

function blockList(lines: readonly string[], key: string): Result.Result<readonly string[], PnpmWorkspaceFailure> {
	return Result.gen(function* () {
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
				return yield* Result.fail(failure(`cannot read "${trimmed}" in ${key}`));
			}
			patterns.push(yield* scalar(trimmed.slice(ITEM.length), key));
		}
		return patterns;
	});
}

export function pnpmWorkspaceList(text: string, key: string): Result.Result<readonly string[], PnpmWorkspaceFailure> {
	const pattern = keyPattern(key);
	const lines = text.split(LINE_BREAK);
	const start = lines.findIndex((line) => pattern.test(line));
	if (start === -1) {
		return Result.succeed([]);
	}
	const rest = withoutComment(lines[start] ?? "")
		.replace(pattern, "")
		.trim();
	if (rest.startsWith("[")) {
		return flowList([rest, ...lines.slice(start + 1)], key);
	}
	if (rest !== "") {
		return Result.fail(failure(`cannot read "${rest}" in ${key}`));
	}
	return blockList(lines.slice(start + 1), key);
}

export function pnpmWorkspacePatterns(text: string): Result.Result<readonly string[], PnpmWorkspaceFailure> {
	return pnpmWorkspaceList(text, "packages");
}
