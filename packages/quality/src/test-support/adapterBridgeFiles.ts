import { DEFAULT_FILES, type SeedFile } from "#testing/adapters/tree.ts";

// Copied from @shivaedev/admin: pure path matching over a type the package declares.
const MATCH_ADMIN_ROUTE = `import type { AdminRoute } from "#page.ts";

export function matchAdminRoute(routes: readonly AdminRoute[], pathname: string): AdminRoute | undefined {
	const path = pathname.replace(/\\/$/u, "");
	if (path === "/admin") {
		return routes[0];
	}
	return (
		routes.find((route) => route.path.replace(/\\/$/u, "") === path)
		?? routes.find((route) => {
			if (route.detail === undefined) {
				return false;
			}
			const expected = route.detail.replace(/\\/$/u, "").split("/");
			const actual = path.split("/");
			return (
				expected.length === actual.length
				&& expected.every((segment, index) => (segment.startsWith("$") ? actual[index] !== "" : segment === actual[index]))
			);
		})
	);
}
`;

// Copied from @shivaedev/quality: browserslist returns plain values, so the call needs no adapter.
const BROWSER_TARGETS = `import { dirname } from "node:path";
import browserslist from "browserslist";

export function browserTargets(file: string): readonly string[] | undefined {
	const queries = browserslist.loadConfig({ env: "production", path: dirname(file) });
	return queries === undefined ? undefined : browserslist(queries);
}
`;

const REMOTE = [
	{ content: '{"name":"remote","types":"index.d.ts"}', path: "node_modules/remote/package.json" },
	{
		content: "export interface Client { load(id: string): Promise<string> }\nexport interface Options { readonly retries: number }\n",
		path: "node_modules/remote/index.d.ts",
	},
	{ content: '{"name":"browserslist","types":"index.d.ts"}', path: "node_modules/browserslist/package.json" },
	{
		content:
			"declare function browserslist(queries: readonly string[]): string[];\ndeclare namespace browserslist { function loadConfig(options: { env: string; path: string }): string[] | undefined }\nexport default browserslist;\n",
		path: "node_modules/browserslist/index.d.ts",
	},
];

const PACKAGE = [
	...DEFAULT_FILES.filter((file) => file.path !== "src/value.ts"),
	{
		content: JSON.stringify({
			dependencies: { browserslist: "*", effect: "*", remote: "*" },
			imports: { "#*": "./src/*" },
			name: "bridges",
			type: "module",
		}),
		path: "package.json",
	},
	{ content: "export interface AdminRoute { readonly detail?: string; readonly path: string }\n", path: "src/page.ts" },
	...REMOTE,
];

export const plainAdapters: readonly SeedFile[] = [
	...PACKAGE,
	{ content: MATCH_ADMIN_ROUTE, path: "src/adapters/matchAdminRoute.ts" },
	{ content: BROWSER_TARGETS, path: "src/adapters/browserTargets.ts" },
	{
		content: 'import type { Options } from "remote";\n\nexport function retries(options: Options): number {\n\treturn options.retries;\n}\n',
		path: "src/adapters/retries.ts",
	},
	{ content: "export function stamp(): number {\n\treturn Date.now();\n}\n", path: "src/adapters/stamp.ts" },
	{ content: 'import { expect, it } from "vitest";\n\nit("matches", () => expect(1).toBe(1));\n', path: "src/adapters/match.test.ts" },
	{ content: "export const kit = (value: number): number => value;\n", path: "src/test-support/adapters/kit.ts" },
];

export const BRIDGES: Readonly<Record<string, string>> = {
	"src/adapters/capture.ts":
		'import { Context, Effect } from "effect";\n\nexport function provided<A>(effect: Effect.Effect<A, never, never>, context: Context.Context<never>) {\n\treturn Effect.provideContext(effect, context);\n}\n',
	"src/adapters/digest.ts":
		'import { createHash } from "node:crypto";\n\nexport function digest(text: string): string {\n\treturn createHash("sha256").update(text).digest("hex");\n}\n',
	"src/adapters/draft.ts": 'export function draft(): string | null {\n\treturn localStorage.getItem("draft");\n}\n',
	"src/adapters/later.ts": "export function later(run: () => void): void {\n\tsetTimeout(run, 10);\n}\n",
	"src/adapters/lookup.ts":
		'import { Effect } from "effect";\nimport type { Client } from "remote";\n\nexport function lookup(client: Client, id: string) {\n\treturn Effect.tryPromise(() => client.load(id));\n}\n',
	"src/adapters/parseDate.ts":
		'import { DateTime } from "effect";\n\nexport function parseDate(text: string) {\n\treturn DateTime.makeUnsafe(text);\n}\n',
	"src/adapters/readRecord.ts":
		"export function readRecord(text: string): { readonly id: string } {\n\tconst record: { readonly id: string } = JSON.parse(text);\n\treturn record;\n}\n",
	"src/adapters/wait.ts": "export async function wait(work: () => Promise<void>): Promise<void> {\n\tawait work();\n}\n",
};

export const bridgingAdapters: readonly SeedFile[] = [...PACKAGE, ...Object.entries(BRIDGES).map(([path, content]) => ({ content, path }))];

export const serviceFolders: readonly SeedFile[] = [
	...PACKAGE,
	{ content: 'export const Mailer = { id: "Mailer" };\n', path: "src/adapters/mailer/service.ts" },
	{ content: 'export function subject(title: string): string {\n\treturn "[mail] " + title;\n}\n', path: "src/adapters/mailer/subject.ts" },
	{ content: "export function send(run: () => void): void {\n\tsetTimeout(run, 0);\n}\n", path: "src/adapters/mailer/send.ts" },
	{ content: 'export const Labels = { id: "Labels" };\n', path: "src/adapters/labels/service.ts" },
	{ content: "export function label(name: string): string {\n\treturn name.trim();\n}\n", path: "src/adapters/labels/label.ts" },
];

export function reportedFiles(report: string): readonly string[] {
	return [...report.matchAll(/^ {2}(?<file>\S+\.[cm]?[jt]sx?)\b/gmu)]
		.map((match) => match.groups?.file ?? "")
		.toSorted((left, right) => left.localeCompare(right));
}
