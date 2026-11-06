import type ts from "typescript";

export function browserLibraryType(type: ts.Type): boolean {
	return [type.getSymbol(), type.aliasSymbol].some((symbol) =>
		(symbol?.declarations ?? []).some((declaration) => {
			const source = declaration.getSourceFile();
			const path = source.fileName.replaceAll("\\", "/");
			return (
				(source.hasNoDefaultLib && /(?:^|\/)lib\.(?:dom|webworker)(?:\.[\w-]+)?\.d\.ts$/u.test(path))
				|| /\/node_modules\/(?:@types\/)?react(?:-dom)?\//u.test(path)
			);
		}),
	);
}
