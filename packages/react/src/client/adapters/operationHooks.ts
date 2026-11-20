import type { LooseCreate, UseCreate } from "#client/create.ts";
import type { LooseEditor, UseEditor } from "#client/editor.ts";

// The hooks' public types derive form fields, `fixed` and `values` from the operation with conditional types that no single implementation
// signature can satisfy for every instantiation. Each body runs on erased types; these name the checked type its callers see.
export function typedCreate(hook: LooseCreate): UseCreate;
export function typedCreate(hook: unknown): unknown {
	return hook;
}

export function typedEditor(hook: LooseEditor): UseEditor;
export function typedEditor(hook: unknown): unknown {
	return hook;
}
