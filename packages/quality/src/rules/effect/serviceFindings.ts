import { relative } from "node:path";
import ts from "typescript";
import { foreignResources } from "#adapters/foreignResources.ts";
import { frameworkCallback, parameterSite } from "#adapters/frameworkCallback.ts";
import { localFunctions } from "#adapters/localFunctions.ts";
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

function implementationParameter(checker: ts.TypeChecker, parameter: ts.ParameterDeclaration, services: ReturnType<typeof serviceTypes>): boolean {
	const fn = parameter.parent;
	const property = ts.isPropertyAssignment(fn.parent) ? fn.parent : fn;
	const object = property.parent;
	return ts.isObjectLiteralExpression(object) && services.implementation(checker.getTypeAtLocation(object));
}

export function serviceFindings(
	root: string,
	sources: readonly ts.SourceFile[],
	checker: ts.TypeChecker,
	services: ReturnType<typeof serviceTypes>,
): readonly Finding[] {
	const resource = foreignResources(checker, sources);
	const findings = new Map<ts.ParameterDeclaration, Finding>();
	const visited = new Set<ts.Type>();
	const activeSignatures = new Set<NonNullable<ts.Signature["declaration"]>>();
	const local = new Set(sources);
	function parameterFinding(symbol: ts.Symbol, signature?: ts.Signature): void {
		if (!services.carries(checker.getTypeOfSymbol(symbol))) {
			return;
		}
		for (const parameter of symbol.declarations ?? []) {
			if (
				!(ts.isParameter(parameter) && local.has(parameter.getSourceFile()))
				|| implementationParameter(checker, parameter, services)
				|| resource(parameter)
				|| frameworkCallback(checker, parameter.parent, local)
				|| (signature !== undefined
					&& (checker.getTypePredicateOfSignature(signature) !== undefined
						|| (signature.declaration !== undefined && layerConstructor(checker, signature.declaration))
						|| signature.getReturnType().getProperty("~effect/Layer") !== undefined))
			) {
				continue;
			}
			const site = parameterSite(checker, parameter, local);
			const source = site.getSourceFile();
			const file = relative(root, source.fileName).replaceAll("\\", "/");
			findings.set(site, {
				file,
				line: source.getLineAndCharacterOfPosition(site.getStart(source)).line + 1,
				message: `Parameter ${site.name.getText(source)} carries a service. Read services from Effect's environment instead of passing them; return an Effect or Stream with requirements. Service implementation methods and Layer constructors are accepted; only test-support/ folders are exempt, not adapters/.`,
			});
		}
	}
	function signatureFinding(signature: ts.Signature): void {
		const declaration = signature.declaration;
		if (
			declaration === undefined
			|| !local.has(declaration.getSourceFile())
			|| layerConstructor(checker, declaration)
			|| checker.getTypePredicateOfSignature(signature) !== undefined
		) {
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
	localFunctions(sources, checker, (signature) => {
		for (const parameter of signature.parameters) {
			parameterFinding(parameter, signature);
		}
	});
	return [...findings.values()];
}
