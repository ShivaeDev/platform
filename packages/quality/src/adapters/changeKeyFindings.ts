import { join } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { changeKeyApi } from "#adapters/changeKeyApi.ts";
import { changeKeyLiterals } from "#adapters/changeKeyLiterals.ts";
import type { Finding, RuleInputs, SourceFile } from "#rule.ts";
import { effectProgram } from "#rules/effect/program.ts";
import { parse } from "#rules/parse.ts";
import { importBindings } from "#rules/stories/importBindings.ts";
import { memberName, nodesWhere, unwrapped } from "#rules/stories/syntax.ts";

const APIS = new Set([
	"invalidateOnCommit",
	"invalidate",
	"invalidateUnsafe",
	"mutation",
	"recordKey",
	"collectionInvalidationKeys",
	"invalidationKeys",
	"readKeys",
]);

function aliasesIn(source: ts.SourceFile): ReadonlySet<string> {
	const aliases = new Set([...importBindings(source)].filter(([, binding]) => APIS.has(binding.imported)).map(([name]) => name));
	for (const node of nodesWhere(source, ts.isVariableDeclaration)) {
		if (!(ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) || node.initializer === undefined) {
			continue;
		}
		const value = unwrapped(node.initializer);
		if ((ts.isIdentifier(value) && aliases.has(value.text)) || APIS.has(memberName(value) ?? "")) {
			aliases.add(node.name.text);
		}
	}
	return aliases;
}

function candidate(node: ts.Node, aliases: ReadonlySet<string>): node is ts.CallExpression {
	if (!(ts.isCallExpression(node) && node.arguments.some((argument) => changeKeyLiterals(argument).length > 0))) {
		return false;
	}
	const callee = unwrapped(node.expression);
	const name = ts.isIdentifier(callee) ? callee.text : memberName(callee);
	return APIS.has(name ?? "") || (ts.isIdentifier(callee) && aliases.has(callee.text));
}

function hasCandidates(file: SourceFile): boolean {
	const source = parse(file);
	if (source === undefined) {
		return false;
	}
	const aliases = aliasesIn(source);
	return nodesWhere(source, (node) => candidate(node, aliases)).length > 0;
}

function findingsIn(inputs: RuleInputs): readonly Finding[] {
	const program = effectProgram(inputs);
	const checker = program.getTypeChecker();
	return inputs.sources.flatMap((file) => {
		const source = program.getSourceFile(join(inputs.root, file.path));
		if (source === undefined) {
			return [];
		}
		const aliases = aliasesIn(source);
		return nodesWhere(source, (node) => candidate(node, aliases)).flatMap((node): readonly Finding[] => {
			if (!ts.isCallExpression(node)) {
				return [];
			}
			const api = changeKeyApi(checker, node.expression);
			const argument = node.arguments[api === "mutation" && node.arguments.length > 1 ? 1 : 0];
			return api === undefined || argument === undefined
				? []
				: changeKeyLiterals(argument, api === "name").map((literal) => ({
						file: file.path,
						line: source.getLineAndCharacterOfPosition(literal.getStart(source)).line + 1,
						message:
							"Names a change collection or bucket with a literal. Import its owner's declaration and use its name, list, item or bucket key instead.",
					}));
		});
	});
}

export const changeKeyFindings = Effect.fn("ChangeKeys.changeKeyFindings")((inputs: RuleInputs) =>
	Effect.sync(() => {
		const groups = new Map<string, RuleInputs["sources"][number][]>();
		for (const source of inputs.sources) {
			if (!hasCandidates(source)) {
				continue;
			}
			const group = /^(?:packages|examples)\/[^/]+/u.exec(source.path)?.[0] ?? ".";
			const sources = groups.get(group) ?? [];
			sources.push(source);
			groups.set(group, sources);
		}
		return [...groups.values()].flatMap((sources) => findingsIn({ ...inputs, sources }));
	}),
);
