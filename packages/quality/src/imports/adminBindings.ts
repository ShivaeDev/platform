import ts from "typescript";

export interface AdminBindings {
	readonly factories: ReadonlySet<string>;
	readonly guards: ReadonlySet<string>;
	readonly permissions: ReadonlySet<string>;
}

function namedImports(source: ts.SourceFile) {
	return source.statements.filter(ts.isImportDeclaration).flatMap((statement) => {
		const bindings = statement.importClause?.namedBindings;
		if (
			!(ts.isStringLiteral(statement.moduleSpecifier) && bindings !== undefined && ts.isNamedImports(bindings))
			|| statement.importClause?.isTypeOnly
		) {
			return [];
		}
		const origin = statement.moduleSpecifier.text;
		return bindings.elements
			.filter((element) => !element.isTypeOnly)
			.map((binding) => ({
				local: binding.name.text,
				name: (binding.propertyName ?? binding.name).text,
				origin,
			}));
	});
}

export function adminBindings(source: ts.SourceFile): AdminBindings {
	const factories = new Set<string>();
	const permissions = new Set<string>();
	const guards = new Set<string>(["middleware"]);
	for (const { local, name, origin } of namedImports(source)) {
		if (origin.startsWith("@shivaedev/admin/") && ["adminPage", "registerAdmin"].includes(name)) {
			factories.add(local);
		}
		if (/(?:^|[/#])admin\//u.test(origin)) {
			permissions.add(local);
		}
		if (origin.startsWith("@shivaedev/") && ["requirePermission", "permissionMiddleware", "permissionReadPolicy"].includes(name)) {
			guards.add(local);
		}
	}
	return { factories, guards, permissions };
}
