import type ts from "typescript";
import { exportsOnlyCallOf } from "#naming/exportsOnlyCallOf.ts";

const OPERATIONS = new Set(["command", "query"]);

export function isOperationFile(source: ts.SourceFile): boolean {
	return exportsOnlyCallOf(source, "@shivaedev/contract/operation.ts", OPERATIONS);
}
