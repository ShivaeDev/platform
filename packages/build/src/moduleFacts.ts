import ts from "typescript";
import { copiedCode } from "#copiedCode.ts";
import { exportedSchemas } from "#exportedSchemas.ts";
import type { ModuleFacts } from "#facts.ts";
import { initializerOf, moduleCalls, propertyOf } from "#moduleCalls.ts";
import { operationFacts } from "#operationFacts.ts";
import type { TypeReading } from "#typeReading.ts";

function readingFor(program: ts.Program, file: string, refuse: (message: string) => void) {
	const checker = program.getTypeChecker();
	const schemasOf = exportedSchemas(program, file);
	return (label: string): TypeReading => ({
		checker,
		program,
		refuse: (type, path, instead) => {
			refuse(`${label}: run returns ${checker.typeToString(type)} at ${path}, which has no exact wire form; ${instead}`);
			return undefined;
		},
		refuseServerOnly: (path, schemaClass) => {
			const where = schemaClass === undefined ? path : `${path}, a field of the Schema class ${schemaClass}`;
			refuse(
				`${label}: run returns a Redacted value at ${where}, which never leaves the server; return a public shape without that field, such as an object of the fields the browser needs`,
			);
			return undefined;
		},
		schemasOf,
	});
}

export function moduleFacts(program: ts.Program, file: string): ModuleFacts {
	// Creating the checker binds the files, which sets the parent links that reading a node's text needs.
	const checker = program.getTypeChecker();
	const refusals = new Set<string>();
	function refuse(message: string) {
		refusals.add(message);
	}
	const empty = { exportName: "", file, keyScope: undefined, middleware: undefined, name: "", operations: [], subject: undefined };
	const source = program.getSourceFile(file);
	const calls = source === undefined ? [] : moduleCalls(source);
	const [call, ...others] = calls;
	if (call === undefined || others.length > 0) {
		return { ...empty, refusals: [`${file}: defines ${calls.length} modules; define exactly one module per file`] };
	}
	const definition = call.definition;
	const nameValue = definition !== undefined && ts.isObjectLiteralExpression(definition) ? initializerOf(propertyOf(definition, "name")) : undefined;
	if (definition === undefined || !ts.isObjectLiteralExpression(definition) || nameValue === undefined || !ts.isStringLiteral(nameValue)) {
		return { ...empty, refusals: [`${file}: defineModule takes an object literal whose name is a string literal`] };
	}
	const name = nameValue.text;
	const exportName = call.variable.name.getText();
	if (!(call.exported && ts.isIdentifier(call.variable.name))) {
		refuse(`${name}: export the module as a const, such as export const ${exportName} = defineModule(...)`);
	}
	const literal = definition;
	function copy(field: string) {
		const node = initializerOf(propertyOf(literal, field));
		return node === undefined ? undefined : copiedCode({ checker, label: `${name} ${field}`, refuse }, node);
	}
	const list = initializerOf(propertyOf(definition, "operations"));
	if (list === undefined || !ts.isArrayLiteralExpression(list)) {
		refuse(`${name}: operations is an array literal of the module's operations`);
	}
	const reading = readingFor(program, file, refuse);
	const elements = list !== undefined && ts.isArrayLiteralExpression(list) ? list.elements : [];
	const operations = elements.flatMap((element) => operationFacts({ moduleName: name, reading, refuse }, element) ?? []);
	return {
		exportName,
		file,
		keyScope: copy("keyScope"),
		middleware: copy("middleware"),
		name,
		operations,
		refusals: [...refusals],
		subject: copy("subject"),
	};
}
