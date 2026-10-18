import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Cause, Effect, Exit } from "effect";
import type { InventoryScope } from "#inventory/collect.ts";
import { seedTree } from "#test/tree.ts";

export const roots: string[] = [];

export function makeRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "quality-fs-"));
	roots.push(root);
	return root;
}

export function failureText<TValue, TError, TRequirements>(
	effect: Effect.Effect<TValue, TError, TRequirements>,
): Effect.Effect<string, never, TRequirements> {
	return Effect.map(Effect.exit(effect), (exit) => (Exit.isFailure(exit) ? Cause.pretty(exit.cause) : "(it succeeded)"));
}

export function scope(overrides: Partial<InventoryScope>): InventoryScope {
	return { exclude: [], extensions: [".ts", ".tsx"], sources: ["."], ...overrides };
}

export function repository() {
	return seedTree([
		{ content: "a\nb\n", path: "src/app.ts" },
		{ content: "<p/>\n", path: "src/view.tsx" },
		{ content: "# Notes\n", path: "docs/notes.md" },
		{ content: "export const route = 1;\n", path: "src/routes/tree.gen.ts" },
		{ content: "export {};\n", path: "scripts/tool.ts" },
	]);
}
