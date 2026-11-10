import type { SqlText } from "#rules/stories/sqlText.ts";
import { sqlTokens, tableAt } from "#rules/stories/sqlTokens.ts";

const SIGNATURES = [
	["id", "email", "emailverified"],
	["id", "accountid", "providerid", "userid"],
	["id", "token", "expiresat", "userid"],
	["id", "identifier", "value", "expiresat"],
];

function columnsAt(tokens: readonly string[], open: number): ReadonlySet<string> {
	let depth = 1;
	let end = open + 1;
	for (; end < tokens.length && depth > 0; end += 1) {
		depth += tokens[end] === "(" ? 1 : 0;
		depth -= tokens[end] === ")" ? 1 : 0;
	}
	const columns = new Set<string>();
	let column = true;
	depth = 0;
	for (const part of tokens.slice(open + 1, end - 1)) {
		if (column) {
			columns.add(part.replaceAll('"', "").replaceAll("_", "").toLowerCase());
			column = false;
		}
		depth += part === "(" ? 1 : 0;
		depth -= part === ")" ? 1 : 0;
		column = part === "," && depth === 0;
	}
	return columns;
}

function definitions(query: SqlText): readonly { readonly name: string; readonly auth: boolean }[] {
	const tokens = sqlTokens(query.text);
	return tokens.flatMap((token, index) => {
		if (token.toLowerCase() !== "create" || tokens[index + 1]?.toLowerCase() !== "table") {
			return [];
		}
		const name = tableAt(tokens, index + 2);
		const open = tokens.indexOf("(", index + 2);
		if (open < 0) {
			return [];
		}
		const columns = columnsAt(tokens, open);
		return name === "" ? [] : [{ auth: SIGNATURES.some((signature) => signature.every((columnName) => columns.has(columnName))), name }];
	});
}

function canonical(name: string): string {
	return name.startsWith("public.") ? name.slice("public.".length) : name;
}

export function authTables(queries: readonly SqlText[], owns: (file: string) => boolean): ReadonlySet<string> {
	const declared = queries.flatMap((query) => definitions(query).map((definition) => ({ ...definition, owner: owns(query.file) })));
	const protectedTables = [...declared.filter(({ auth, owner }) => auth || owner).map(({ name }) => canonical(name))];

	return new Set([...protectedTables, ...protectedTables.filter((name) => !name.includes(".")).map((name) => `public.${name}`)]);
}
