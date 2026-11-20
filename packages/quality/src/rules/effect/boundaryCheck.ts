import { Effect } from "effect";
import ts from "typescript";
import { isPackageRootConfig } from "#imports/isTooling.ts";
import { packageOf, workspacePackages } from "#imports/workspace.ts";
import { inTestSupport } from "#naming/unsafeFolders.ts";
import type { Finding, RuleInputs, SourceFile, TypeScriptProgram } from "#rule.ts";
import { boundaryGuidance } from "#rules/effect/boundaryFindings.ts";
import { promiseCall } from "#rules/effect/promiseCall.ts";
import { parses } from "#rules/parse.ts";

// TypeScript 6 fails with a Debug Failure when it resolves a story kit's it call against installed declarations, so tests stay with the syntax half; a failure elsewhere names its file.
const TEST = /\.(?:test|spec)\.[cm]?[jt]sx?$/u;

export const boundaryCheck = Effect.fn("Boundary.boundaryCheck")(function* (inputs: RuleInputs) {
	const packages = yield* workspacePackages(inputs);
	const workspace = new Set(packages.map((owner) => owner.name));
	return {
		checks: (file: SourceFile) =>
			!(inTestSupport(file.path) || TEST.test(file.path))
			&& /\.[cm]?[jt]sx?$/u.test(file.path)
			&& !isPackageRootConfig(packageOf(packages, file.path)?.directory ?? ".", file.path)
			&& parses(file),
		eachFile: true as const,
		findings: (files: readonly SourceFile[], { program, sourceFile }: TypeScriptProgram): readonly Finding[] => {
			const promised = promiseCall(program, workspace);
			return files.flatMap((file) => {
				const source = sourceFile(file.path);
				const findings: Finding[] = [];
				function visit(node: ts.Node): void {
					const name = promised(node);
					if (name !== undefined && source !== undefined) {
						findings.push({
							file: file.path,
							line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
							message: boundaryGuidance(name),
						});
					}
					ts.forEachChild(node, visit);
				}
				if (source !== undefined) {
					visit(source);
				}
				return findings;
			});
		},
	};
});
