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
const EXPRESSION_FROM = new Set(["extract", "overlay", "substring", "trim"]);
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

function userForeignKeyAt(tokens: readonly string[], index: number, statementStart: number): boolean {
	const statement = tokens.slice(statementStart, index).map((token) => token.toLowerCase());
	if (tokens[index]?.toLowerCase() !== "references" || !["create", "alter"].includes(statement[0] ?? "") || !statement.includes("table")) {
		return false;
	}
	let table = index + 1;
	while (tokens[table + 1] === ".") {
		table += 2;
	}
	if (tokens[table + 1] !== "(" || !["id", '"id"'].includes(tokens[table + 2]?.toLowerCase() ?? "") || tokens[table + 3] !== ")") {
		return false;
	}
	const remainder = tokens.slice(table + 4);
	const end = remainder.findIndex((token) => [",", ";", ")"].includes(token));
	const clause = remainder.slice(0, end === -1 ? undefined : end).join(" ");
	return /\bon delete (?:cascade|set null)\b/iu.test(clause);
}

interface SqlContext {
	depth: number;
	readonly expressionFromDepths: Set<number>;
	statementStart: number;
	readonly tablesAtDepth: Set<number>;
}

function advanceContext(context: SqlContext, token: string, index: number, previous: string | undefined): void {
	if (token === ";") {
		context.statementStart = index + 1;
		context.expressionFromDepths.clear();
	}
	if (token === "(") {
		context.depth += 1;
		if (EXPRESSION_FROM.has(previous?.toLowerCase() ?? "")) {
			context.expressionFromDepths.add(context.depth);
		}
	}
	if (token === ")") {
		context.tablesAtDepth.delete(context.depth);
		context.expressionFromDepths.delete(context.depth);
		context.depth -= 1;
	}
}

function authTableIn(text: string): boolean {
	const tokens = [...text.matchAll(TOKENS)]
		.map(([token]) => token)
		.filter((token) => !(token.startsWith("--") || token.startsWith("/*") || token.startsWith("'")));
	const context: SqlContext = { depth: 0, expressionFromDepths: new Set(), statementStart: 0, tablesAtDepth: new Set() };
	return tokens.some((token, index) => {
		advanceContext(context, token, index, tokens[index - 1]);
		const boundary = tableBoundary(tokens, index, context.statementStart, !context.expressionFromDepths.has(context.depth));
		if (boundary.ends) {
			context.tablesAtDepth.delete(context.depth);
		}
		if (boundary.starts) {
			context.tablesAtDepth.add(context.depth);
		}
		return (
			(boundary.starts || (token === "," && context.tablesAtDepth.has(context.depth)))
			&& AUTH_TABLES.has(tableAt(tokens, index + 1))
			&& !(tableAt(tokens, index + 1) === "user" && userForeignKeyAt(tokens, index, context.statementStart))
		);
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
					"SQL accesses a Better Auth table (user, account, session or verification). Use platform's auth API (@shivaedev/identity) for account data; app migrations may only reference user(id) with ON DELETE CASCADE or ON DELETE SET NULL. Only the configured auth-sql owners manage auth storage.",
			})),
	description: "Apps reference user IDs by foreign key and use identity for account data.",
	id: "boundaries/auth-sql",
	options: Schema.toStandardSchemaV1(AuthSqlOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
});
