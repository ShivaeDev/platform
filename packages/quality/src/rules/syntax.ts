import ts from "typescript";
import type { SourceFile } from "../rule.ts";

const SCRIPT_KINDS: ReadonlyArray<readonly [RegExp, ts.ScriptKind]> = [
	[/\.[cm]?ts$/, ts.ScriptKind.TS],
	[/\.tsx$/, ts.ScriptKind.TSX],
	[/\.[cm]?js$/, ts.ScriptKind.JS],
	[/\.jsx$/, ts.ScriptKind.JSX],
];

export const parse = (file: SourceFile): ts.SourceFile | undefined => {
	const kind = SCRIPT_KINDS.find(([pattern]) => pattern.test(file.path))?.[1];
	return kind === undefined ? undefined : ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind);
};
