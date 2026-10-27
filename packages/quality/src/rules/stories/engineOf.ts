import type { Endpoint } from "#imports/resolve.ts";

const ENGINES: ReadonlyArray<readonly [string, readonly string[]]> = [
	["the file system", ["node:fs"]],
	[
		"the network",
		[
			"node:dgram",
			"node:dns",
			"node:http",
			"node:http2",
			"node:https",
			"node:net",
			"node:tls",
			"effect/http",
			"effect/socket",
			"@effect/platform-browser",
			"@effect/platform-bun",
			"@effect/platform-node",
			"@effect/platform-node-shared",
			"@trpc/client",
			"@trpc/server",
			"express",
			"fastify",
			"hono",
			"undici",
			"ws",
		],
	],
	["a process", ["node:child_process", "node:cluster", "node:process", "node:readline", "effect/process", "claude-code"]],
	["a worker", ["node:worker_threads", "effect/workers"]],
	[
		"a database",
		[
			"node:sqlite",
			"effect/persistence",
			"effect/sql",
			"@effect/sql",
			"@effect/sql-pg",
			"@effect/sql-sqlite-node",
			"@electric-sql/pglite",
			"@prisma/client",
			"@prisma-next/",
			"better-auth",
			"better-sqlite3",
			"mysql2",
			"pg",
			"pg-boss",
			"postgres",
		],
	],
	["the DOM", ["@happy-dom/", "@playwright/test", "@testing-library/", "happy-dom", "jsdom", "playwright", "react-dom"]],
	["a story engine", ["@shivaedev/test-sql", "@shivaedev/local-postgres", "@shivaedev/test-story"]],
];

function names(prefix: string, specifier: string): boolean {
	return prefix.endsWith("/") ? specifier.startsWith(prefix) : specifier === prefix || specifier.startsWith(`${prefix}/`);
}

export function engineOf(endpoint: Endpoint): string | undefined {
	// HttpStatus only maps names to numbers; importing it acquires no network services.
	if (endpoint.kind === "file" || endpoint.specifier === "effect/http/HttpStatus") {
		return undefined;
	}
	return ENGINES.find(([, prefixes]) => prefixes.some((prefix) => names(prefix, endpoint.specifier) || names(prefix, endpoint.package)))?.[0];
}
