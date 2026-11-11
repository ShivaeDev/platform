import { join } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import type { RuleInputs, SourceFile } from "#rule.ts";

const SCRIPT_KINDS: ReadonlyArray<readonly [RegExp, ts.ScriptKind]> = [
	[/\.[cm]?ts$/u, ts.ScriptKind.TS],
	[/\.tsx$/u, ts.ScriptKind.TSX],
	[/\.[cm]?js$/u, ts.ScriptKind.JS],
	[/\.jsx$/u, ts.ScriptKind.JSX],
];

interface SharedTree {
	readonly name: string;
	tree?: ts.SourceFile | undefined;
}

const shared = new WeakMap<SourceFile, SharedTree>();

function kindOf(file: SourceFile): ts.ScriptKind | undefined {
	return SCRIPT_KINDS.find(([pattern]) => pattern.test(file.path))?.[1];
}

function created(file: SourceFile, name: string): ts.SourceFile | undefined {
	const kind = kindOf(file);
	return kind === undefined ? undefined : ts.createSourceFile(name, file.text, ts.ScriptTarget.Latest, true, kind);
}

export function parses(file: SourceFile): boolean {
	return kindOf(file) !== undefined;
}

export function parse(file: SourceFile): ts.SourceFile | undefined {
	const slot = shared.get(file);
	if (slot === undefined) {
		return created(file, file.path);
	}
	if (!("tree" in slot)) {
		slot.tree = created(file, slot.name);
	}
	return slot.tree;
}

// A shared tree carries its absolute path because the story program, which binds the same trees, renames every file it loads to the path it asked for.
export function withSharedTrees<TValue, TError, TServices>(
	inputs: Pick<RuleInputs, "root" | "sources">,
	rules: Effect.Effect<TValue, TError, TServices>,
): Effect.Effect<TValue, TError, TServices> {
	return Effect.acquireUseRelease(
		Effect.sync(() => {
			const registered = inputs.sources.filter((file) => !shared.has(file));
			for (const file of registered) {
				shared.set(file, { name: join(inputs.root, file.path) });
			}
			return registered;
		}),
		() => rules,
		(registered) =>
			Effect.sync(() => {
				for (const file of registered) {
					shared.delete(file);
				}
			}),
	);
}
