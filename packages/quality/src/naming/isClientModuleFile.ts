import type ts from "typescript";
import { exportsOnlyCallOf } from "#naming/exportsOnlyCallOf.ts";

const CLIENT_MODULE = new Set(["clientModule"]);

// A module's client/module.tsx is the convention file the client's module list is found by, so its name may repeat the modules folder.
export function isClientModuleFile(source: ts.SourceFile): boolean {
	return exportsOnlyCallOf(source, "@shivaedev/react/client/module.ts", CLIENT_MODULE);
}
