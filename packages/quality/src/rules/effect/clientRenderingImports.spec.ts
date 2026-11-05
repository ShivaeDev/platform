import { expect } from "@effect/vitest";
import { adapterImports } from "#rules/effect/adapterImports.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const path of ["src/client/Navigation.tsx", "src/modules/notes/client/Navigation.tsx"]) {
	ruleStory.it(
		`effect/adapter-imports accepts UI, router and styling imports in the client component ${path}`,
		[
			repositoryHas(
				{
					content: JSON.stringify({
						dependencies: { "@base-ui/react": "*", "@tanstack/react-router": "*", "cn": "*", "lucide-react": "*", "react": "*" },
						optionalDependencies: { "@tanstack/react-table": "*", "class-variance-authority": "*", "clsx": "*", "tailwind-merge": "*" },
						peerDependencies: { "react-dom": "*" },
					}),
					path: "package.json",
				},
				{
					content: [
						'import { Button } from "@base-ui/react/button";',
						'import { Link } from "@tanstack/react-router";',
						'import { createColumnHelper } from "@tanstack/react-table";',
						'import { cva } from "class-variance-authority";',
						'import { clsx } from "clsx";',
						'import { cn } from "cn";',
						'import { Home } from "lucide-react";',
						'import { useState } from "react";',
						'import { createPortal } from "react-dom";',
						'import { twMerge } from "tailwind-merge";',
						'export const Navigation = () => <Link to="/"><Button className={cn("nav")}><Home /></Button></Link>;',
					].join("\n"),
					path,
				},
			),
		],
		function* ({ check }) {
			const findings = yield* check(adapterImports);

			expect(findings).toEqual([]);
		},
	);
}

for (const path of ["src/core.tsx", "src/server/Navigation.tsx", "src/clientish/Navigation.tsx"]) {
	ruleStory.it(
		`effect/adapter-imports reports UI, router and styling imports outside client code in ${path}`,
		[
			repositoryHas(
				{ content: '{"dependencies":{"lucide-react":"*","@tanstack/react-router":"*","cn":"*"}}', path: "package.json" },
				{ content: 'import "lucide-react";\nimport "@tanstack/react-router";\nimport "cn";', path },
			),
		],
		function* ({ check }) {
			const findings = yield* check(adapterImports);

			expect(findings.map(({ file, line }) => `${file}:${line}`)).toEqual([`${path}:1`, `${path}:2`, `${path}:3`]);
		},
	);
}

ruleStory.it(
	"effect/adapter-imports still reports I/O, external state and rendering-package lookalikes in client modules",
	[
		repositoryHas(
			{
				content: '{"dependencies":{"axios":"*","better-auth":"*","@tanstack/react-query":"*","zustand":"*","lucide-react-extra":"*"}}',
				path: "package.json",
			},
			{
				content:
					'import "axios";\nimport "better-auth/react";\nimport "@tanstack/react-query";\nimport "zustand";\nimport "lucide-react-extra";\nimport "node:fs/promises";',
				path: "src/client/integrations.ts",
			},
		),
	],
	function* ({ check }) {
		const findings = yield* check(adapterImports);

		expect(
			findings.toSorted((left, right) => (left.line ?? 0) - (right.line ?? 0)).map(({ file, line, message }) => `${file}:${line} ${message}`),
		).toEqual(
			["axios", "better-auth/react", "@tanstack/react-query", "zustand", "lucide-react-extra", "node:fs/promises"].map(
				(name, index) =>
					`src/client/integrations.ts:${index + 1} Imports outside library "${name}" as a value. Move the integration into an adapters/ folder and expose Effect values; use import type for types.`,
			),
		);
	},
);
