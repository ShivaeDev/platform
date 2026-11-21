import { Effect, FileSystem, Option } from "effect";
import ts from "typescript";
import { type ProjectConfig, resolvedModule } from "#adapters/typeScript.ts";
import { byText } from "#byText.ts";

type LocalType = ts.InterfaceDeclaration | ts.TypeAliasDeclaration;

interface DeclaredProperty {
	readonly name: string;
	readonly never: boolean;
}

function declaredProperties(type: ts.TypeNode, local: ReadonlyMap<string, LocalType>): readonly DeclaredProperty[] {
	if (ts.isParenthesizedTypeNode(type)) {
		return declaredProperties(type.type, local);
	}
	if (ts.isIntersectionTypeNode(type)) {
		return type.types.flatMap((each) => declaredProperties(each, local));
	}
	const referenced = ts.isTypeReferenceNode(type) && ts.isIdentifier(type.typeName) ? local.get(type.typeName.text) : undefined;
	if (referenced !== undefined) {
		return ts.isTypeAliasDeclaration(referenced) ? declaredProperties(referenced.type, local) : membersOf(referenced.members);
	}
	return ts.isTypeLiteralNode(type) ? membersOf(type.members) : [];
}

function membersOf(members: ts.NodeArray<ts.TypeElement>): readonly DeclaredProperty[] {
	return members.flatMap((member) =>
		ts.isPropertySignature(member) && (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name))
			? [{ name: member.name.text, never: member.type?.kind === ts.SyntaxKind.NeverKeyword }]
			: [],
	);
}

function unionMembers(type: ts.TypeNode): readonly ts.TypeNode[] {
	if (ts.isParenthesizedTypeNode(type)) {
		return unionMembers(type.type);
	}
	return ts.isUnionTypeNode(type) ? type.types.flatMap(unionMembers) : [type];
}

export interface RegistrationParts {
	readonly names: readonly string[];
	readonly unreadable: readonly string[];
}

function formsOf(appModule: LocalType, local: ReadonlyMap<string, LocalType>): readonly (readonly DeclaredProperty[])[] {
	return ts.isTypeAliasDeclaration(appModule)
		? unionMembers(appModule.type).map((form) => declaredProperties(form, local))
		: [membersOf(appModule.members)];
}

// A property every form of AppModule may carry, which leaves out the group, handlers, module and name that tell the forms apart,
// so a part the server adds is one the look-alike check knows. An AppModule declared as an interface has one form, so each of its
// properties is a part.
export function registrationParts(declaration: ts.SourceFile): readonly string[] {
	const local = new Map(
		declaration.statements.flatMap((statement): readonly (readonly [string, LocalType])[] =>
			ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) ? [[statement.name.text, statement]] : [],
		),
	);
	const appModule = local.get("AppModule");
	const forms = appModule === undefined ? [] : formsOf(appModule, local);
	const names = [...new Set(forms.flat().map(({ name }) => name))].sort(byText);
	return names.filter((name) => forms.every((properties) => properties.some((property) => property.name === name && !property.never)));
}

export const registrationPartsOf = Effect.fn("Build.registrationPartsOf")(function* (config: ProjectConfig, root: string) {
	const fs = yield* FileSystem.FileSystem;
	const declaration = yield* resolvedModule(config, root, "@shivaedev/server/AppModule.ts");
	if (Option.isNone(declaration)) {
		const none: RegistrationParts = { names: [], unreadable: [] };
		return none;
	}
	const text = yield* fs.readFileString(declaration.value);
	const names = registrationParts(ts.createSourceFile(declaration.value, text, ts.ScriptTarget.Latest, true));
	const parts: RegistrationParts = {
		names,
		unreadable:
			names.length > 0
				? []
				: [
						`${declaration.value}: declares no AppModule type alias or interface with a property every form of registration may carry, so the generator cannot refuse a registration written without \`satisfies AppModule\`; install @shivaedev/server and @shivaedev/build from the same Platform release`,
					],
	};
	return parts;
});
