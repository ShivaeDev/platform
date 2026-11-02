import { Result } from "effect";
import { MarkdownBudgetTooSmall } from "./errors.ts";

export interface MarkdownRowsOptions {
	readonly byteLimit?: number;
	readonly header?: string;
}

export interface MarkdownRowsSection {
	readonly header?: string;
	readonly rows: readonly string[];
}

export function renderRows(
	rows: readonly string[],
	{ byteLimit = 60_000, header = "" }: MarkdownRowsOptions = {},
): Result.Result<string, MarkdownBudgetTooSmall> {
	return prepareRows({ header, rows }).render(byteLimit);
}

export function renderSections(
	sections: readonly MarkdownRowsSection[],
	{ byteLimit = 60_000 }: Pick<MarkdownRowsOptions, "byteLimit"> = {},
): Result.Result<string, MarkdownBudgetTooSmall> {
	const prepared = sections.filter(({ rows, header = "" }) => rows.length > 0 || header !== "").map(prepareRows);
	let reserved = prepared.reduce((total, section) => total + section.minimumBytes, 0) + Math.max(0, prepared.length - 1) * 2;
	let remaining = byteLimit;
	const bodies: string[] = [];
	for (const section of prepared) {
		reserved -= section.minimumBytes;
		const body = section.render(remaining - reserved);
		if (Result.isFailure(body)) {
			return Result.fail(new MarkdownBudgetTooSmall({ byteLimit }));
		}
		bodies.push(body.success);
		remaining -= new TextEncoder().encode(body.success).byteLength + 2;
		reserved -= 2;
	}
	return Result.succeed(bodies.join("\n\n"));
}

function prepareRows({ rows, header = "" }: MarkdownRowsSection) {
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
	function omitted(kept: number) {
		const notice = `and ${rows.length - kept} more`;
		const separator = kept > 0 || header !== "" ? "\n\n" : "";
		return { bytes: bodySize(kept) + separator.length + encoder.encode(notice).byteLength, notice, separator };
	}
	return {
		minimumBytes: rows.length === 0 ? headerBytes : Math.min(bodySize(rows.length), omitted(0).bytes),
		render(byteLimit: number): Result.Result<string, MarkdownBudgetTooSmall> {
			if (bodySize(rows.length) <= byteLimit) {
				return Result.succeed(body(rows.length));
			}
			for (let kept = rows.length - 1; kept >= 0; kept -= 1) {
				const { notice, separator, bytes } = omitted(kept);
				if (bytes <= byteLimit) {
					return Result.succeed(body(kept) + separator + notice);
				}
			}
			return Result.fail(new MarkdownBudgetTooSmall({ byteLimit }));
		},
	};
}
