import type { SeedFile } from "#testing/adapters/tree.ts";

export const packageFiles: readonly SeedFile[] = [
	{ content: '{"workspaces":["apps/*"]}', path: "package.json" },
	{ content: '{"name":"@example/server","devDependencies":{"@example/traces":"workspace:*"}}', path: "apps/server/package.json" },
	{ content: "export const send = () => 'sent';", path: "apps/server/src/mail/send.ts" },
	{ content: '{"name":"@example/traces","exports":{"./*.ts":"./src/*.ts"}}', path: "apps/traces/package.json" },
	{ content: "export const trace = 'recorded';", path: "apps/traces/src/trace.ts" },
	{ content: 'import { trace } from "../../../traces/src/trace.ts"; export const resting = trace;', path: "apps/server/test/mail/resting.ts" },
	{ content: 'import { send } from "../../src/mail/send.ts";', path: "apps/server/test/mail/send.test.ts" },
	{ content: 'import { send } from "../src/mail/send.ts";', path: "apps/server/test/delivery.spec.ts" },
	{ content: '{"name":"@example/desktop","private":true,"devDependencies":{"@example/traces":"workspace:*"}}', path: "apps/desktop/package.json" },
	{ content: "export const tracing = 'enabled';", path: "apps/desktop/src/tracing.ts" },
	{ content: 'import { trace } from "../../traces/src/trace.ts"; export const tracingKit = trace;', path: "apps/desktop/test/tracing-kit.ts" },
	{ content: '{"name":"@example/runner","private":true}', path: "apps/runner/package.json" },
	{ content: "export const runner = 'ready';", path: "apps/runner/src/runner.ts" },
];

export const compositionFiles: readonly SeedFile[] = [
	...packageFiles,
	{
		content: '{"name":"@example/assembly","private":true,"exports":{"./*.ts":"./src/*.ts"},"imports":{"#test/*":"./src/test-support/*"}}',
		path: "apps/assembly/package.json",
	},
	{ content: 'import { support } from "#test/support.ts"; export const fixture = support;', path: "apps/assembly/src/fixture.ts" },
	{ content: "export const support = 'ready';", path: "apps/assembly/src/test-support/support.ts" },
	{ content: 'import { fixture } from "../../assembly/src/fixture.ts";', path: "apps/server/test/assembly.spec.ts" },
];

export function fakeBackend(path: string, lines: number): SeedFile {
	return { content: Array.from({ length: lines }, (_, index) => `export const response${index} = ${index};`).join("\n"), path };
}
