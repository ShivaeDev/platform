import type ts from "typescript";

// A registry or RPC client is the handle a plain function, which has no Effect environment, works through.
export function clientHandle(type: ts.Type): boolean {
	return (
		type.getProperty("~effect/reactivity/AtomRegistry") !== undefined
		|| (type.getProperty("mutation")?.declarations ?? []).some((declaration) =>
			/\/effect\/(?:src|dist)\/reactivity\/AtomRpc\.(?:d\.)?ts$/u.test(declaration.getSourceFile().fileName.replaceAll("\\", "/")),
		)
	);
}
