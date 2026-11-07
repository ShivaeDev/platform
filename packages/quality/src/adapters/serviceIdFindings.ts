import { join } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { packageOf, type WorkspacePackage, workspacePackages } from "#imports/workspace.ts";
import type { Finding, RuleInputs } from "#rule.ts";
import { boundaryReference } from "#rules/effect/boundaryReference.ts";

function definitionId(node: ts.Expression | undefined): ts.Expression | undefined {
	if (node === undefined || !ts.isObjectLiteralExpression(node)) {
		return undefined;
	}
	const property = node.properties.find(
		(member) => ts.isPropertyAssignment(member) && (ts.isIdentifier(member.name) || ts.isStringLiteralLike(member.name)) && member.name.text === "id",
	);
	return property !== undefined && ts.isPropertyAssignment(property) ? property.initializer : undefined;
}

function literalId(checker: ts.TypeChecker, call: ts.CallExpression, ownPackage: boolean): ts.StringLiteralLike | undefined {
	const callee = ts.isCallExpression(call.expression) && call.expression.arguments.length === 0 ? call.expression.expression : call.expression;
	const reference = boundaryReference(checker, callee) ?? "";
	let id = call.arguments[0];
	if (
		(ownPackage && reference === "#adapters/defineService.ts.defineService")
		|| /^@shivaedev\/service\/defineService(?:\.ts)?\.defineService$/u.test(reference)
	) {
		id = definitionId(id);
	} else if (
		!(
			/^effect(?:\.Context|\/Context)\.(?:Service|Reference)$/u.test(reference)
			|| /^(?:effect\/(?:unstable\/)?rpc(?:\.RpcMiddleware|\/RpcMiddleware)|@effect\/rpc(?:\.RpcMiddleware|\/RpcMiddleware))\.(?:Service|Tag)$/u.test(
				reference,
			)
		)
	) {
		return undefined;
	}
	return id !== undefined && ts.isStringLiteralLike(id) ? id : undefined;
}

function checkPackage(inputs: RuleInputs, prefix: string): readonly Finding[] {
	const texts = new Map(inputs.sources.map((file) => [join(inputs.root, file.path), file.text]));
	const options: ts.CompilerOptions = { allowJs: true, noLib: true, noResolve: true, target: ts.ScriptTarget.Latest };
	const host = ts.createCompilerHost(options);
	host.readFile = (path) => texts.get(path);
	const program = ts.createProgram([...texts.keys()], options, host);
	const checker = program.getTypeChecker();
	return inputs.sources.flatMap((file) => {
		const source = program.getSourceFile(join(inputs.root, file.path));
		const findings: Finding[] = [];
		function visit(node: ts.Node): void {
			const id = ts.isCallExpression(node) ? literalId(checker, node, prefix === "@shivaedev/service/") : undefined;
			if (id !== undefined && !id.text.startsWith(prefix) && source !== undefined) {
				findings.push({
					file: file.path,
					line: source.getLineAndCharacterOfPosition(id.getStart(source)).line + 1,
					message: `Service id ${JSON.stringify(id.text)} must start with ${JSON.stringify(prefix)}. Prefix the id with its package name and update references to that id.`,
				});
			}
			ts.forEachChild(node, visit);
		}
		if (source !== undefined) {
			visit(source);
		}
		return findings;
	});
}

export const serviceIdFindings = Effect.fn("ServiceIds.serviceIdFindings")(function* (inputs: RuleInputs) {
	const packages = yield* Effect.promise(() => workspacePackages(inputs));
	const groups = new Map<WorkspacePackage, RuleInputs["sources"][number][]>();
	for (const source of inputs.sources) {
		if (!source.path.startsWith("packages/")) {
			continue;
		}
		const owner = packageOf(packages, source.path);
		if (owner !== undefined) {
			const files = groups.get(owner) ?? [];
			files.push(source);
			groups.set(owner, files);
		}
	}
	return [...groups].flatMap(([owner, sources]) => checkPackage({ ...inputs, sources }, `${owner.name}/`));
});
