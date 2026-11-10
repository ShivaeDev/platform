import ts from "typescript";
import { copiedCode } from "#adapters/copiedCode.ts";
import { failuresOf } from "#adapters/failuresOf.ts";
import { initializerOf, propertyOf } from "#adapters/moduleCalls.ts";
import { literalOf, type TypeReading, typeArguments } from "#adapters/typeReading.ts";
import { wireForm } from "#adapters/wireForm.ts";
import type { CodePart, OperationFacts } from "#facts.ts";

export interface OperationReading {
	readonly moduleName: string;
	readonly reading: (label: string) => TypeReading;
	readonly refuse: (message: string) => void;
}

function declarationOf(checker: ts.TypeChecker, element: ts.Expression) {
	const symbol = checker.getSymbolAtLocation(element);
	const target = symbol !== undefined && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
	const declaration = target?.valueDeclaration;
	const call = declaration !== undefined && ts.isVariableDeclaration(declaration) ? declaration.initializer : undefined;
	const literal = call !== undefined && ts.isCallExpression(call) ? call.arguments[1] : undefined;
	return declaration === undefined || literal === undefined || !ts.isObjectLiteralExpression(literal) ? undefined : { declaration, literal };
}

// What an Effect-returning property of the operation succeeds and fails with.
function effectArguments(checker: ts.TypeChecker, owner: ts.Type, property: string, at: ts.Node): readonly ts.Type[] {
	const symbol = owner.getProperty(property);
	const [signature] = symbol === undefined ? [] : checker.getTypeOfSymbolAtLocation(symbol, at).getCallSignatures();
	return signature === undefined ? [] : typeArguments(checker, signature.getReturnType());
}

function textOf(checker: ts.TypeChecker, owner: ts.Type, property: string): string | number | undefined {
	const symbol = owner.getProperty(property);
	return symbol === undefined ? undefined : literalOf(checker.getTypeOfSymbol(symbol));
}

// Without run's types the operation did not compile; a run returning any is the common cause, and gets its own message.
function refuseUnread(context: OperationReading, label: string, literal: ts.ObjectLiteralExpression) {
	const reading = context.reading(label);
	const run = propertyOf(literal, "run");
	const signature = run !== undefined && ts.isMethodDeclaration(run) ? reading.checker.getSignatureFromDeclaration(run) : undefined;
	const returned = signature === undefined ? undefined : typeArguments(reading.checker, signature.getReturnType())[1];
	if (returned !== undefined && returned.flags & ts.TypeFlags.Any) {
		reading.refuse(returned, "success", "decode the value with a schema, or give it a type");
	} else {
		context.refuse(`${label}: run's result cannot be read; fix the compile errors on the operation first`);
	}
}

export function operationFacts(context: OperationReading, element: ts.Expression): OperationFacts | undefined {
	const reading = context.reading(context.moduleName);
	const found = declarationOf(reading.checker, element);
	if (found === undefined) {
		context.refuse(`${context.moduleName}: ${element.getText()} in operations is not a const built by query or command with an object literal`);
		return undefined;
	}
	const type = reading.checker.getTypeAtLocation(found.declaration);
	const name = String(textOf(reading.checker, type, "name") ?? element.getText());
	const kind = textOf(reading.checker, type, "kind") === "command" ? "command" : "query";
	const label = `${context.moduleName}.${name}`;
	const [success, runError] = effectArguments(reading.checker, type, "run", found.declaration);
	if (success === undefined) {
		refuseUnread(context, label, found.literal);
	}
	const [, policyError] = kind === "query" ? effectArguments(reading.checker, type, "readPolicy", found.declaration) : [];
	const literal = found.literal;
	function copy(field: string, member: boolean): readonly CodePart[] | undefined {
		const property = propertyOf(literal, field);
		const node = member ? property : initializerOf(property);
		return node === undefined ? undefined : copiedCode({ checker: reading.checker, label: `${label} ${field}`, refuse: context.refuse }, node);
	}
	return {
		failures: failuresOf(
			context.reading(label),
			[runError, policyError].flatMap((error) => error ?? []),
		),
		invalidates: copy("invalidates", true),
		kind,
		name,
		payload: copy("payload", false),
		reads: copy("reads", true),
		readsCollections: copy("readsCollections", true),
		success: success === undefined ? undefined : wireForm(context.reading(label), success, "success"),
	};
}
