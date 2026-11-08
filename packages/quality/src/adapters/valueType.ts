import ts from "typescript";
import { browserLibraryType } from "#adapters/browserLibraryType.ts";

export function valueType(type: ts.Type): boolean {
	return (
		browserLibraryType(type)
		|| (type.flags
			& (ts.TypeFlags.Any
				| ts.TypeFlags.Unknown
				| ts.TypeFlags.Never
				| ts.TypeFlags.StringLike
				| ts.TypeFlags.NumberLike
				| ts.TypeFlags.BooleanLike
				| ts.TypeFlags.ESSymbolLike
				| ts.TypeFlags.BigIntLike))
			!== 0
	);
}
