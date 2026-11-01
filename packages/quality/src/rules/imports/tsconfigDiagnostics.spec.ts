import { expect } from "vitest";
import { importsResolvable } from "#rules/imports/resolvable.ts";
import { importStory, repositoryHas } from "#test/importStory.ts";

const SOURCES = repositoryHas(
	{ content: "export const first = 1;", path: "src/first.ts" },
	{ content: "export const second = 2;", path: "src/second.ts" },
);

importStory.it(
	"imports/resolvable reports a malformed tsconfig once for all its source files",
	[SOURCES, repositoryHas({ content: '{"compilerOptions": {', path: "tsconfig.json" })],
	function* ({ check }) {
		const findings = yield* check(importsResolvable);

		expect(findings).toEqual([
			expect.objectContaining({
				file: "tsconfig.json",
				line: 1,
				message: expect.stringContaining("Repair the tsconfig before trusting import findings."),
				subject: "TS1005",
			}),
		]);
	},
);

importStory.it(
	"imports/resolvable reports an invalid compiler option in the extended config that declares it",
	[
		SOURCES,
		repositoryHas(
			{ content: '{"extends":"./compiler.json"}', path: "tsconfig.json" },
			{ content: '{"compilerOptions":{"moduleResolution":"sideways"}}', path: "compiler.json" },
		),
	],
	function* ({ check }) {
		expect(yield* check(importsResolvable)).toEqual([
			expect.objectContaining({ file: "compiler.json", line: 1, message: expect.stringContaining("moduleResolution"), subject: "TS6046" }),
		]);
	},
);

importStory.it(
	"imports/resolvable reports a missing extended config",
	[SOURCES, repositoryHas({ content: '{"extends":"./missing.json"}', path: "tsconfig.json" })],
	function* ({ check }) {
		expect(yield* check(importsResolvable)).toEqual([
			expect.objectContaining({ file: "tsconfig.json", message: expect.stringContaining("missing.json"), subject: "TS5083" }),
		]);
	},
);

importStory.it(
	"imports/resolvable reports an unreadable referenced config instead of silently using empty options",
	[SOURCES, repositoryHas({ content: '{"files":[],"references":[{"path":"./missing"}]}', path: "tsconfig.json" })],
	function* ({ check }) {
		expect(yield* check(importsResolvable)).toEqual([
			expect.objectContaining({ file: "missing/tsconfig.json", message: expect.stringContaining("Cannot read file"), subject: "TS5083" }),
		]);
	},
);
