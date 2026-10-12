import remarkDirective from "remark-directive";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { expect, it } from "vitest";
import { BadRequest } from "@shivaedev/platform/errors/taxonomy.ts";
import { renderVisual } from "./visual.ts";

it.each([
	{ message: "supported fields", source: ':::metric{invalid="field"}\nLabel\n\nSource: [Checks](checks.md)\n:::' },
	{ message: "Name a source", source: ':::metric{value="1" unit="files"}\nLabel\n:::' },
	{ message: "Name a source", source: ':::progress{completed="1" total="2"}\nLabel\n:::' },
	{ message: "Reduce completed or correct total", source: ':::progress{completed="3" total="2"}\nLabel\n\nSource: [Checks](checks.md)\n:::' },
	{ message: "Use one ordered list", source: ":::timeline\nLabel\n\n- [Entry](checks.md)\n:::" },
	{ message: "Each timeline entry needs text and a source link", source: ":::timeline\nLabel\n\n1. Entry without source.\n:::" },
	{ message: "Start with a Markdown label", source: ':::metric{value="1" unit="files"}\nSource: [Checks](checks.md)\n:::' },
])("returns a typed visual validation failure for $message", ({ source, message }) => {
	const node = unified().use(remarkParse).use(remarkDirective).parse(source).children.at(0);
	expect(node?.type).toBe("containerDirective");
	if (node?.type === "containerDirective") {
		expect(() => renderVisual(node)).toThrow(BadRequest);
		expect(() => renderVisual(node)).toThrow(message);
	}
});
