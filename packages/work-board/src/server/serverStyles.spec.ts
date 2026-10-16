import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { expect, it } from "vitest";
import { ASSETS } from "#server/http/assets.ts";

it("keeps CSS literals and inline style elements out of server source and served string assets", () => {
	const root = new URL("./", import.meta.url);
	const violations: string[] = [];
	for (const file of readdirSync(root, { encoding: "utf8", recursive: true })) {
		if (!/\.tsx?$/u.test(file) || /\.(?:test|spec)\.tsx?$/u.test(file)) {
			continue;
		}
		const source = ts.createSourceFile(file, readFileSync(join(root.pathname, file), "utf8"), ts.ScriptTarget.Latest);
		function visit(node: ts.Node) {
			if (
				(ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))
				&& /<style\b|@(?:import|layer|media)\b|^\s*(?:--)?[a-z][a-z-]*\s*:[^{}]+;|\{\s*(?:--)?[a-z][a-z-]*\s*:[^{}]*[;}]/iu.test(node.text)
			) {
				violations.push(file);
			}
			ts.forEachChild(node, visit);
		}
		visit(source);
	}
	expect(violations).toEqual([]);
	expect(ASSETS.some(([, , type]) => type === "text/css")).toBe(false);
});
