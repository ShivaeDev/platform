import { describe, expect, it } from "vitest";
import { documentedImports } from "#docs/documentedImports.ts";

const workspace = { packages: (name: string) => name === "@acme/lib" };

describe("documentedImports", () => {
	it("reads default, named, aliased and type-only imports from code blocks with their source lines", () => {
		const markdown = [
			"Intro",
			"",
			"```tsx",
			"",
			'import Lib, { type Shape, make as build } from "@acme/lib/make.ts";',
			'import * as other from "other/module.ts";',
			"```",
		].join("\n");
		expect(documentedImports(markdown, workspace)).toEqual([
			{ line: 5, specifier: "@acme/lib/make.ts" },
			{ line: 5, name: "default", specifier: "@acme/lib/make.ts", typeOnly: false },
			{ line: 5, name: "Shape", specifier: "@acme/lib/make.ts", typeOnly: true },
			{ line: 5, name: "make", specifier: "@acme/lib/make.ts", typeOnly: false },
		]);
	});

	it("reads package modules from prose and the owner's own modules only from API sections and table rows", () => {
		const markdown = [
			"Save the example as `notes.ts`, then call `make` from `@acme/lib/make.ts`.",
			"| `table.ts`, `row.ts` | Helpers |",
			"## API",
			"The module also exposes `extra.ts`.",
			"## Install",
			"Save your settings as `app.ts`.",
		].join("\n");
		expect(documentedImports(markdown, { ...workspace, owner: "@acme/lib" }).map((entry) => [entry.line, entry.specifier, entry.name])).toEqual([
			[1, "@acme/lib/make.ts", undefined],
			[1, "@acme/lib/make.ts", "make"],
			[2, "@acme/lib/table.ts", undefined],
			[2, "@acme/lib/row.ts", undefined],
			[4, "@acme/lib/extra.ts", undefined],
		]);
	});
});
