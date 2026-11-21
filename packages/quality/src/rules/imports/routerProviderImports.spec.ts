import { importsRuntime } from "#rules/imports/runtime.ts";
import { importStory, repositoryHas } from "#test/importStory.ts";
import { assertThat } from "#testing/assertThat.ts";

const APPLICATION = { content: '{"name":"app","private":true,"dependencies":{"@shivaedev/platform":"workspace:*"}}', path: "package.json" };

const CLIENT = { content: '{"name":"client","dependencies":{"@shivaedev/react":"workspace:*"}}', path: "package.json" };

const REPAIR = 'import { RouterProvider } from "@shivaedev/react/RouterProvider.ts"';

importStory.it(
	"imports/runtime reports TanStack Router's RouterProvider in an application and names the react package's provider",
	[
		repositoryHas(APPLICATION, {
			content: 'import { createRouter, RouterProvider } from "@tanstack/react-router";\nexport { createRouter, RouterProvider };',
			path: "src/client/App.tsx",
		}),
	],
	function* ({ check }) {
		const findings = yield* check(importsRuntime);

		yield* assertThat(findings, (actual) =>
			actual.toEqual([
				{
					file: "src/client/App.tsx",
					line: 1,
					message:
						"TanStack Router's RouterProvider does not tell useFirstSettled when the first route has rendered, so a first screen it holds is revealed onto loading states. Mount the react package's provider instead, which takes the same props: `import { RouterProvider } from \"@shivaedev/react/RouterProvider.ts\"`.",
					subject: "@tanstack/react-router",
				},
			]),
		);
	},
);

for (const content of [
	'import { RouterProvider as Routes } from "@tanstack/react-router";',
	'export { RouterProvider } from "@tanstack/react-router";',
]) {
	importStory.it(
		`imports/runtime reports TanStack Router's RouterProvider in a package that depends on @shivaedev/react, loaded by ${content}`,
		[repositoryHas(CLIENT, { content, path: "src/App.tsx" })],
		function* ({ check, messages }) {
			yield* check(importsRuntime);

			yield* assertThat(yield* messages(), (actual, expect) => actual.toEqual([expect.stringContaining(REPAIR)]));
		},
	);
}

importStory.it(
	"imports/runtime accepts the react package's provider, type-only and other TanStack Router imports",
	[
		repositoryHas(CLIENT, {
			content:
				'import { RouterProvider } from "@shivaedev/react/RouterProvider.ts";\nimport type { RouterProvider as Provider } from "@tanstack/react-router";\nimport { type RouterProviderProps, createRouter, Link } from "@tanstack/react-router";\nexport { type RouterProvider as Routes } from "@tanstack/react-router";',
			path: "src/App.tsx",
		}),
	],
	function* ({ check }) {
		yield* assertThat(yield* check(importsRuntime), (actual) => actual.toEqual([]));
	},
);

importStory.it(
	"imports/runtime reports TanStack Router's RouterProvider only in the workspace package that depends on @shivaedev/react",
	[
		repositoryHas(
			{ content: '{"name":"root","private":true}', path: "package.json" },
			{ content: "packages:\n  - packages/*\n", path: "pnpm-workspace.yaml" },
			{ content: '{"name":"web","dependencies":{"@shivaedev/react":"workspace:*"}}', path: "packages/web/package.json" },
			{ content: 'import { RouterProvider } from "@tanstack/react-router";', path: "packages/web/src/App.tsx" },
			{ content: '{"name":"docs-site","dependencies":{"@tanstack/react-router":"1.0.0"}}', path: "packages/docs-site/package.json" },
			{ content: 'import { RouterProvider } from "@tanstack/react-router";', path: "packages/docs-site/src/App.tsx" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(importsRuntime);

		yield* assertThat(
			findings.map(({ file }) => file),
			(actual) => actual.toEqual(["packages/web/src/App.tsx"]),
		);
	},
);

importStory.it(
	"imports/runtime reports TanStack Router's RouterProvider in adapters/ and accepts it in specs and test-support/",
	[
		repositoryHas(
			APPLICATION,
			{ content: 'import { RouterProvider } from "@tanstack/react-router";', path: "src/client/adapters/routes.tsx" },
			{ content: 'import { RouterProvider } from "@tanstack/react-router";', path: "src/client/App.dom.spec.tsx" },
			{ content: 'import { RouterProvider } from "@tanstack/react-router";', path: "src/test-support/screens.tsx" },
		),
	],
	function* ({ check }) {
		const findings = yield* check(importsRuntime);

		yield* assertThat(
			findings.map(({ file }) => file),
			(actual) => actual.toEqual(["src/client/adapters/routes.tsx"]),
		);
	},
);
