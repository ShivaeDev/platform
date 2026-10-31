export const boundaryShapes = [
	{
		code: 'import { readFileSync as read } from "node:fs";\nexport const text = read("file", "utf8");',
		found: [[2, "synchronous IO (node:fs.readFileSync)"]],
		name: "an aliased synchronous filesystem call",
	},
	{
		code: 'import fs from "node:fs";\nexport const text = fs["readFileSync"]("file", "utf8");',
		found: [[2, "synchronous IO (node:fs.readFileSync)"]],
		name: "a synchronous filesystem call through a default import and string key",
	},
	{
		code: 'import * as fs from "fs";\nexport const present = fs.existsSync("file");',
		found: [[2, "synchronous IO (fs.existsSync)"]],
		name: "a synchronous filesystem call through a namespace import",
	},
	{
		code: 'import * as fs from "node:fs";\nconst { readFileSync: read } = fs;\nexport const text = read("file", "utf8");',
		found: [[3, "synchronous IO (node:fs.readFileSync)"]],
		name: "a destructured synchronous filesystem call",
	},
	...(["execFileSync", "execSync", "spawnSync"] as const).map((member) => ({
		code: `import { ${member} as execute } from "node:child_process";\nexport const result = execute("git");`,
		found: [[2, `synchronous IO (node:child_process.${member})`]] as const,
		name: `a synchronous ${member} call`,
	})),
	...(["runSync", "runPromise", "runFork", "runPromiseWith"] as const).map((runner) => ({
		code: `import { Effect as E } from "effect";\nexport const result = E.${runner}(work);`,
		found: [[2, `effect.Effect.${runner} outside an entry point`]] as const,
		name: `a core ${runner} runner`,
	})),
	{
		code: 'import * as E from "effect/Effect";\nexport const result = work.pipe(E.runSync);',
		found: [[2, "effect/Effect.runSync outside an entry point"]],
		name: "a piped core runner",
	},
	{
		code: 'import { runSync as run } from "effect/Effect";\nexport const result = work.pipe(run);',
		found: [[2, "effect/Effect.runSync outside an entry point"]],
		name: "a piped runner imported by name",
	},
	{
		code: 'import { Effect } from "effect";\nconst run = Effect.runSync;\nexport const result = run(work);',
		found: [
			[2, "effect.Effect.runSync outside an entry point"],
			[3, "effect.Effect.runSync outside an entry point"],
		],
		name: "an aliased core runner",
	},
	{
		code: 'import { Effect } from "effect";\nexport const read = Effect.sync(() => JSON.parse(input));',
		found: [[2, "Effect.sync with a throwing body"]],
		name: "Effect.sync around JSON.parse",
	},
	{
		code: 'import { Effect, Schema as S } from "effect";\nexport const read = Effect.sync(() => S.decodeUnknownSync(schema)(input));',
		found: [[2, "Effect.sync with a throwing body"]],
		name: "Effect.sync around a synchronous Schema decoder",
	},
	{
		code: 'import { Effect } from "effect";\nexport const read = Effect.sync(decodeURIComponent);',
		found: [[2, "Effect.sync with a throwing body"]],
		name: "Effect.sync given a throwing API as its callback",
	},
	{ code: "export const read = (work: Promise<string>) => work;", found: [[1, "Promise-typed parameter (work)"]], name: "a Promise parameter" },
	{
		code: "type Load = () => Promise<string>;\nexport const read = (work: Load | undefined) => work;",
		found: [[2, "Promise-typed parameter (work)"]],
		name: "an aliased Promise callback parameter",
	},
] as const;
