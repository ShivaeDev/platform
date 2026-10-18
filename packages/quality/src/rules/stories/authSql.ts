import { Effect, Schema } from "effect";
import { defineRule } from "#rule.ts";
import { matchesAny } from "./matchesAny.ts";
import { sqlTexts } from "./sqlText.ts";

const AuthSqlOptions = Schema.Struct({
	owners: Schema.Array(Schema.String).pipe(Schema.withDecodingDefaultKey(Effect.succeed([]))),
});

const TOKENS = /--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|"(?:""|[^"])*"|[\w$]+|[.,;()]/gu;
const TABLE_START = new Set(["from", "join", "update", "into", "table", "truncate", "references", "using"]);
const TABLE_END = new Set(["where", "group", "order", "having", "limit", "returning", "set", "values", "on", ";"]);
const SKIP = new Set(["if", "not", "exists", "only", "table"]);
const AUTH_TABLES = new Set(["user", "account", "session", "verification"]);

function tableAt(tokens: readonly string[], index: number): string {
	let next = index;
	while (SKIP.has(tokens[next]?.toLowerCase() ?? "")) {
		next += 1;
	}
	while (tokens[next + 1] === ".") {
		next += 2;
	}
	return (tokens[next] ?? "").replaceAll('"', "").toLowerCase();
}

function authTableIn(text: string): boolean {
	const tokens = [...text.matchAll(TOKENS)]
		.map(([token]) => token)
		.filter((token) => !(token.startsWith("--") || token.startsWith("/*") || token.startsWith("'")));
	const tablesAtDepth = new Set<number>();
	let depth = 0;
	return tokens.some((token, index) => {
		const word = token.toLowerCase();
		if (token === "(") {
			depth += 1;
		}
		if (token === ")") {
			tablesAtDepth.delete(depth);
			depth -= 1;
		}
		const indexTarget = word === "on" && tokens.slice(0, index).some((part) => part.toLowerCase() === "index");
		const startsTable = TABLE_START.has(word) || indexTarget;
		if (TABLE_END.has(word)) {
			tablesAtDepth.delete(depth);
		}
		if (startsTable) {
			tablesAtDepth.add(depth);
		}
		return (startsTable || (token === "," && tablesAtDepth.has(depth))) && AUTH_TABLES.has(tableAt(tokens, index + 1));
	});
}

export const authSql = defineRule({
	check: async ({ options, ...inputs }) =>
		(await sqlTexts(inputs))
			.filter((query) => !matchesAny(query.file, options.owners) && authTableIn(query.text))
			.map((query) => ({
				file: query.file,
				line: query.line,
				message:
					"SQL accesses a Better Auth table (user, account, session or verification). Use platform's auth API; only platform's auth implementation and its migrations, named in the repository's auth-sql owners, own those tables.",
			})),
	description: "Apps use platform's auth API instead of querying or modifying Better Auth's tables.",
	id: "boundaries/auth-sql",
	options: Schema.toStandardSchemaV1(AuthSqlOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
