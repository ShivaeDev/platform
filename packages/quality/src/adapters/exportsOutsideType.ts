import ts from "typescript";
import { declaredModule } from "#imports/declaredModule.ts";

function functionValue(node: ts.VariableDeclaration): ts.SignatureDeclaration | undefined {
	const value = node.initializer;
	return value !== undefined && (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) ? value : undefined;
}

function hidden(member: ts.ClassElement): boolean {
	return (
		(member.name !== undefined && ts.isPrivateIdentifier(member.name))
		|| ((ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined) ?? []).some((modifier) => modifier.kind === ts.SyntaxKind.PrivateKeyword)
	);
}

function annotation(type: ts.TypeNode | undefined): readonly ts.Node[] {
	return type === undefined ? [] : [type];
}

function signatureParts(node: ts.Node): readonly ts.Node[] {
	if (ts.isFunctionLike(node)) {
		return [...(node.typeParameters ?? []), ...node.parameters.flatMap((parameter) => annotation(parameter.type)), ...annotation(node.type)];
	}
	if (ts.isVariableDeclaration(node)) {
		const value = functionValue(node);
		return [...annotation(node.type), ...(value === undefined ? [] : signatureParts(value))];
	}
	if (ts.isClassDeclaration(node)) {
		return [...(node.heritageClauses ?? []), ...node.members.filter((member) => !hidden(member)).flatMap(signatureParts)];
	}
	if (ts.isPropertyDeclaration(node)) {
		return annotation(node.type);
	}
	return ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) ? [node] : [];
}

function referencedName(node: ts.Node): ts.Node | undefined {
	if (ts.isTypeReferenceNode(node)) {
		return node.typeName;
	}
	if (ts.isTypeQueryNode(node)) {
		return node.exprName;
	}
	return ts.isExpressionWithTypeArguments(node) ? node.expression : undefined;
}

function objectFlags(type: ts.Type): number {
	return "objectFlags" in type && typeof type.objectFlags === "number" ? type.objectFlags : 0;
}

function reference(type: ts.Type): type is ts.TypeReference {
	return (objectFlags(type) & ts.ObjectFlags.Reference) !== 0;
}

function inferredDeclaration(node: ts.Node): ts.Node | undefined {
	if (ts.isVariableDeclaration(node)) {
		return functionValue(node) ?? (node.type === undefined ? node.name : undefined);
	}
	return ts.isFunctionLike(node) && node.type === undefined ? node : undefined;
}

export function exportsOutsideType(program: ts.Program, source: ts.SourceFile, outside: (module: string) => boolean): boolean {
	const checker = program.getTypeChecker();
	function resolved(symbol: ts.Symbol): ts.Symbol {
		return symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
	}
	function outsideSymbol(symbol: ts.Symbol | undefined): boolean {
		const files = (symbol === undefined ? [] : (resolved(symbol).declarations ?? [])).map((declaration) => declaration.getSourceFile());
		return (
			!files.some((file) => program.isSourceFileDefaultLibrary(file))
			&& files.some((file) => {
				const module = declaredModule(file.fileName);
				return module !== undefined && outside(module);
			})
		);
	}
	function signatureTypes(signature: ts.Signature): readonly ts.Type[] {
		return [...signature.getParameters().map((parameter) => checker.getTypeOfSymbol(parameter)), signature.getReturnType()];
	}
	function local(symbol: ts.Symbol | undefined): boolean {
		return symbol === undefined || (symbol.declarations ?? []).some((declaration) => declaration.getSourceFile() === source);
	}
	// A type named in another module shows in the declaration file by that name, so only its type arguments are this module's API.
	function typeParts(type: ts.Type): readonly ts.Type[] {
		if (!local(type.aliasSymbol)) {
			return type.aliasTypeArguments ?? [];
		}
		if (type.isUnionOrIntersection()) {
			return type.types;
		}
		const parts = reference(type) ? checker.getTypeArguments(type) : [];
		if ((objectFlags(type) & ts.ObjectFlags.Anonymous) === 0) {
			return parts;
		}
		return [
			...parts,
			...type.getProperties().map((property) => checker.getTypeOfSymbol(property)),
			...type.getCallSignatures().flatMap(signatureTypes),
		];
	}
	function outsideType(type: ts.Type, seen: Set<ts.Type>): boolean {
		if (seen.has(type)) {
			return false;
		}
		seen.add(type);
		return outsideSymbol(type.aliasSymbol) || outsideSymbol(type.getSymbol()) || typeParts(type).some((part) => outsideType(part, seen));
	}
	function inferred(node: ts.Node): boolean {
		const target = inferredDeclaration(node);
		if (target === undefined) {
			return false;
		}
		if (!ts.isFunctionLike(target)) {
			return outsideType(checker.getTypeAtLocation(target), new Set());
		}
		const signature = checker.getSignatureFromDeclaration(target);
		return signature !== undefined && outsideType(signature.getReturnType(), new Set());
	}
	const followed = new Set<ts.Node>();
	// A type this module declares without exporting is still printed into its declaration file, so its references count.
	function localDeclarations(name: ts.Node): readonly ts.Node[] {
		const symbol = checker.getSymbolAtLocation(name);
		const found = (symbol === undefined ? [] : (resolved(symbol).declarations ?? [])).filter(
			(declaration) => declaration.getSourceFile() === source && !followed.has(declaration),
		);
		for (const declaration of found) {
			followed.add(declaration);
		}
		return found;
	}
	function references(node: ts.Node): boolean {
		const name = referencedName(node);
		if (name !== undefined && outsideSymbol(checker.getSymbolAtLocation(name))) {
			return true;
		}
		const declared = name === undefined ? [] : localDeclarations(name);
		return (
			declared.some((declaration) => inferred(declaration) || signatureParts(declaration).some(references))
			|| (ts.forEachChild(node, references) ?? false)
		);
	}
	const module = checker.getSymbolAtLocation(source);
	const declarations = (module === undefined ? [] : checker.getExportsOfModule(module))
		.flatMap((symbol) => resolved(symbol).declarations ?? [])
		.filter((declaration) => declaration.getSourceFile() === source);
	return declarations.some((declaration) => inferred(declaration) || signatureParts(declaration).some(references));
}
