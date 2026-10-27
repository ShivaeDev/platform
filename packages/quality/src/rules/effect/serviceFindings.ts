import { relative } from "node:path";
import ts from "typescript";
import type { Finding } from "#rule.ts";
import { layerConstructor } from "#rules/effect/layerConstructor.ts";
import { publicFunctions } from "#rules/effect/publicFunctions.ts";
import type { serviceTypes } from "#rules/effect/serviceTypes.ts";

function publicDeclaration(declaration: ts.Declaration, local: ReadonlySet<ts.SourceFile>): boolean {
	if (!local.has(declaration.getSourceFile()) || ts.getCombinedModifierFlags(declaration) & (ts.ModifierFlags.Private | ts.ModifierFlags.Protected)) {
		return false;
	}
	return !((ts.isMethodDeclaration(declaration) || ts.isPropertyDeclaration(declaration)) && ts.isPrivateIdentifier(declaration.name));
}

export function serviceFindings(
	root: string,
	sources: readonly ts.SourceFile[],
	checker: ts.TypeChecker,
	services: ReturnType<typeof serviceTypes>,
): readonly Finding[] {
	const findings = new Map<ts.ParameterDeclaration, Finding>();
	const visited = new Set<ts.Type>();
	const activeSignatures = new Set<NonNullable<ts.Signature["declaration"]>>();
	const local = new Set(sources);
	function parameterFinding(symbol: ts.Symbol): void {
		if (!services.carries(checker.getTypeOfSymbol(symbol))) {
			return;
		}
		for (const parameter of symbol.declarations ?? []) {
			if (!(ts.isParameter(parameter) && local.has(parameter.getSourceFile()))) {
				continue;
			}
			const source = parameter.getSourceFile();
			const file = relative(root, source.fileName).replaceAll("\\", "/");
			findings.set(parameter, {
				file,
				line: source.getLineAndCharacterOfPosition(parameter.getStart(source)).line + 1,
				message: `Parameter ${parameter.name.getText(source)} carries a service. Read services from Effect's environment instead of passing them; return an Effect or Stream with requirements. Service implementation methods and Layer constructors are accepted; only test-support/ folders are exempt, not adapters/.`,
			});
		}
	}
	function signatureFinding(signature: ts.Signature): void {
		const declaration = signature.declaration;
		if (declaration === undefined || !local.has(declaration.getSourceFile()) || layerConstructor(checker, declaration)) {
			return;
		}
		const result = signature.getReturnType();
		if (result.getProperty("~effect/Layer") !== undefined) {
			return;
		}
		for (const parameter of signature.parameters) {
			parameterFinding(parameter);
		}
		if (activeSignatures.has(declaration)) {
			return;
		}
		activeSignatures.add(declaration);
		surface(result);
		activeSignatures.delete(declaration);
	}
	function members(type: ts.Type): void {
		if (type.isUnionOrIntersection()) {
			for (const part of type.types) {
				surface(part);
			}
		}
		for (const index of checker.getIndexInfosOfType(type)) {
			surface(index.type);
		}
		for (const signature of type.getConstructSignatures()) {
			surface(signature.getReturnType());
		}
		for (const property of type
			.getProperties()
			.filter((candidate) => (candidate.declarations ?? []).some((declaration) => publicDeclaration(declaration, local)))) {
			surface(checker.getTypeOfSymbol(property));
		}
	}
	function surface(type: ts.Type): void {
		if (visited.has(type) || !(type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection | ts.TypeFlags.Union))) {
			return;
		}
		visited.add(type);
		const signatures = type.getCallSignatures();
		const constructsLayer = signatures.some((signature) => signature.declaration !== undefined && layerConstructor(checker, signature.declaration));
		if (services.computation(type) || (!constructsLayer && services.implementation(type))) {
			return;
		}
		members(type);
		for (const signature of signatures) {
			signatureFinding(signature);
		}
	}
	publicFunctions(sources, checker, surface);
	return [...findings.values()];
}
