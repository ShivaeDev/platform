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
const NON_TABLE_TARGETS = new Set([
	"all",
	"database",
	"domain",
	"foreign",
	"function",
	"language",
	"large",
	"parameter",
	"procedure",
	"routine",
	"schema",
	"sequence",
	"tablespace",
	"type",
]);

function tableAt(tokens: readonly string[], index: number): string {
	let next = index;
	while (SKIP.has(tokens[next]?.toLowerCase() ?? "")) {
		const only = tokens[next]?.toLowerCase() === "only";
		next += 1;
		if (only && tokens[next] === "(") {
			next += 1;
		}
	}
	while (tokens[next + 1] === ".") {
		next += 2;
	}
	return (tokens[next] ?? "").replaceAll('"', "").toLowerCase();
}

function tableBoundary(tokens: readonly string[], index: number, statementStart: number, fromIsTable: boolean) {
	const word = tokens[index]?.toLowerCase() ?? "";
	const permissions = ["grant", "revoke"].includes(tokens[statementStart]?.toLowerCase() ?? "");
	const roleTarget = permissions && (word === "to" || word === "from");
	const permissionTarget = permissions && word === "on" && !NON_TABLE_TARGETS.has(tokens[index + 1]?.toLowerCase() ?? "");
	const indexTarget = word === "on" && tokens.slice(statementStart, index).some((part) => part.toLowerCase() === "index");
	const tableClause = TABLE_START.has(word) && (word !== "from" || fromIsTable);
	return {
		ends: TABLE_END.has(word) || roleTarget,
		starts: !roleTarget && (tableClause || indexTarget || permissionTarget),
	};
}

interface SqlContext {
	depth: number;
	readonly queriesAtDepth: Set<number>;
	statementStart: number;
	readonly tablesAtDepth: Set<number>;
}

function advanceContext(context: SqlContext, token: string, index: number): void {
	if (token === ";") {
		context.statementStart = index + 1;
		context.queriesAtDepth.clear();
	}
	if (token === "(") {
		context.depth += 1;
	}
	if (token === ")") {
		context.tablesAtDepth.delete(context.depth);
		context.queriesAtDepth.delete(context.depth);
		context.depth -= 1;
	}
	if (token.toLowerCase() === "select") {
		context.queriesAtDepth.add(context.depth);
	}
}

function authTableIn(text: string): boolean {
	const tokens = [...text.matchAll(TOKENS)]
		.map(([token]) => token)
		.filter((token) => !(token.startsWith("--") || token.startsWith("/*") || token.startsWith("'")));
	const context: SqlContext = { depth: 0, queriesAtDepth: new Set(), statementStart: 0, tablesAtDepth: new Set() };
	return tokens.some((token, index) => {
		advanceContext(context, token, index);
		const boundary = tableBoundary(tokens, index, context.statementStart, context.depth === 0 || context.queriesAtDepth.has(context.depth));
		if (boundary.ends) {
			context.tablesAtDepth.delete(context.depth);
		}
		if (boundary.starts) {
			context.tablesAtDepth.add(context.depth);
		}
		return (boundary.starts || (token === "," && context.tablesAtDepth.has(context.depth))) && AUTH_TABLES.has(tableAt(tokens, index + 1));
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
