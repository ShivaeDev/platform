import ts from "typescript";
import type { RuleInputs } from "#rule.ts";
import { parse } from "#rules/parse.ts";
import { unwrapped } from "./syntax.ts";

export interface SqlText {
	readonly file: string;
	readonly line: number;
	readonly text: string;
}

const SQL_START =
	/^\s*(?:(?:--[^\n]*\n|\/\*[\s\S]*?\*\/)\s*)*(?:select|with|insert|update|delete|truncate|alter|drop|create|grant|revoke|comment)\b/iu;
const SQL_CALLEE = /^(?:sql|query|execute|exec|raw)(?:\.|$)|\.(?:sql|unsafe|query|execute|exec|raw)$/iu;

function interpolation(node: ts.Expression): string {
	if (ts.isStringLiteralLike(node)) {
		return node.text;
	}
	return ts.isCallExpression(node) && node.arguments.every(ts.isStringLiteralLike)
		? node.arguments
				.filter(ts.isStringLiteralLike)
				.map((argument) => argument.text)
				.join(".")
		: " ? ";
}

function templateText(node: ts.TemplateLiteral): string {
	return ts.isNoSubstitutionTemplateLiteral(node)
		? node.text
		: node.head.text + node.templateSpans.map((span) => interpolation(span.expression) + span.literal.text).join("");
}

function textOf(expression: ts.Expression): string | undefined {
	const node = unwrapped(expression);
	if (ts.isStringLiteralLike(node)) {
		return node.text;
	}
	if (ts.isTemplateExpression(node)) {
		return templateText(node);
	}
	if (ts.isObjectLiteralExpression(node)) {
		const query = node.properties.find((property) => ts.isPropertyAssignment(property) && property.name.getText() === "text");
		return query !== undefined && ts.isPropertyAssignment(query) ? textOf(query.initializer) : undefined;
	}
	if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
		return `${textOf(node.left) ?? " ? "}${textOf(node.right) ?? " ? "}`;
	}
	return undefined;
}

function queryAt(node: ts.Node, source: ts.SourceFile): string | undefined {
	let text: string | undefined;
	let explicit = false;
	if (ts.isTaggedTemplateExpression(node)) {
		text = templateText(node.template);
		explicit = SQL_CALLEE.test(node.tag.getText(source));
	} else if (ts.isCallExpression(node)) {
		text = node.arguments[0] === undefined ? undefined : textOf(node.arguments[0]);
		explicit = SQL_CALLEE.test(node.expression.getText(source));
	} else if (ts.isVariableDeclaration(node) && node.initializer !== undefined) {
		text = textOf(node.initializer);
	}
	return text !== undefined && (explicit || SQL_START.test(text)) ? text : undefined;
}

function queriesIn(file: string, source: ts.SourceFile): readonly SqlText[] {
	const queries: SqlText[] = [];
	function visit(node: ts.Node): void {
		const text = queryAt(node, source);
		if (text !== undefined) {
			queries.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, text });
			return;
		}
		if (!ts.isTaggedTemplateExpression(node)) {
			ts.forEachChild(node, visit);
		}
	}
	visit(source);
	return queries;
}

export async function sqlTexts(inputs: RuleInputs): Promise<readonly SqlText[]> {
	const code = inputs.sources.flatMap((file) => {
		const source = parse(file);
		return source === undefined ? [] : queriesIn(file.path, source);
	});
	const sql = await Promise.all(
		inputs.files
			.filter((file) => file.endsWith(".sql"))
			.map(async (file) => {
				const text = inputs.sources.find((source) => source.path === file)?.text ?? (await inputs.readText(file));
				if (text === undefined) {
					throw new Error(`Cannot read SQL file ${file}. Restore the file or repair its read permissions.`);
				}
				return { file, line: 1, text };
			}),
	);
	return [...code, ...sql];
}
