import { expect } from "@effect/vitest";
import { rawServers } from "#rules/stories/rawServers.ts";
import { ruleCases } from "#test/ruleCases.ts";

const repository = ruleCases.repository();

const HELPERS =
	"loopbackServer from @shivaedev/test-story/server/adapters/loopback.ts, which listens on a loopback port and closes it with the story's scope, or fake an outside HTTP API with fakeHttpService from @shivaedev/test-story/server/fakeHttpService.ts.";
const HTTP_REPAIR = `Hand the server to ${HELPERS}`;
const NET_REPAIR = `For a free port or a listening endpoint, hand a node:http server to ${HELPERS}`;

for (const { line, module, repair, server } of [
	{
		line: 2,
		module: "node:http",
		repair: HTTP_REPAIR,
		server: 'import { createServer } from "node:http";\nconst server = createServer();\nserver.listen(0);',
	},
	{
		line: 2,
		module: "node:http",
		repair: HTTP_REPAIR,
		server: 'import http from "http";\nhttp.createServer((request, response) => response.end()).listen(0, "127.0.0.1");',
	},
	{
		line: 2,
		module: "node:https",
		repair: HTTP_REPAIR,
		server:
			'import * as https from "node:https";\nconst server = https.createServer({});\nawait new Promise((resolve) => server.listen(0, resolve));',
	},
	{
		line: 2,
		module: "node:net",
		repair: NET_REPAIR,
		server: 'import { Server as Listener } from "node:net";\nconst server = new Listener();\nserver.listen({ host: "127.0.0.1", port: 0 });',
	},
	{
		line: 3,
		module: "node:net",
		repair: NET_REPAIR,
		server: 'import net from "node:net";\nlet server;\nserver = net.createServer() as net.Server;\nserver.listen(0);',
	},
]) {
	ruleCases.it(
		`tests/raw-servers reports a test-support ${module} server listening on a port and names the shared helpers`,
		[repository.has({ content: server, path: "src/test-support/host.ts" })],
		function* ({ check }) {
			const findings = yield* check(rawServers);

			expect(findings).toEqual([
				{ file: "src/test-support/host.ts", line, message: `Starts a ${module} server with listen in test-support. ${repair}` },
			]);
		},
	);
}

const RAW_LISTEN = 'import { createServer } from "node:http";\nexport const server = createServer();\nserver.listen(0);';

ruleCases.it(
	"tests/raw-servers accepts production servers and test-story's own adapters",
	[
		repository.has(
			{ content: RAW_LISTEN, path: "src/server/host.ts" },
			{ content: RAW_LISTEN, path: "packages/test-story/src/server/adapters/loopback.ts" },
		),
	],
	function* ({ check }) {
		expect(yield* check(rawServers)).toEqual([]);
	},
);

ruleCases.it(
	"tests/raw-servers accepts a test-support Node server handed to loopbackServer beside another library's listening server",
	[
		repository.has({
			content: [
				'import { createServer } from "node:http";',
				'import { createServer as createVite } from "vite";',
				'import { loopbackServer } from "@shivaedev/test-story/server/adapters/loopback.ts";',
				"const host = createServer((request, response) => response.end());",
				"export const origin = loopbackServer(host);",
				"export const port = loopbackServer(createServer());",
				"const vite = await createVite();",
				"vite.listen();",
			].join("\n"),
			path: "src/test-support/host.ts",
		}),
	],
	function* ({ check }) {
		expect(yield* check(rawServers)).toEqual([]);
	},
);

ruleCases.it(
	"tests/raw-servers accepts a test-support server listening on a Unix socket path, which loopbackServer cannot serve",
	[
		repository.has({
			content: [
				'import { createServer } from "node:net";',
				`export const stale = (path: string) => createServer().listen(\`\${path}.stale\`).on("error", () => {});`,
				"const server = createServer();",
				'server.listen({ path: "/tmp/host.sock" });',
			].join("\n"),
			path: "src/test-support/socket.ts",
		}),
	],
	function* ({ check }) {
		expect(yield* check(rawServers)).toEqual([]);
	},
);

ruleCases.it(
	"tests/raw-servers accepts a test-support node:net server that handles its own sockets",
	[
		repository.has({
			content: [
				'import { connect, createServer } from "node:net";',
				"const relay = (incoming) => incoming.pipe(connect(5432)).pipe(incoming);",
				"const proxy = createServer((incoming) => incoming.pipe(connect(5432)).pipe(incoming));",
				'proxy.listen(0, "127.0.0.1");',
				"createServer(relay).listen(0);",
			].join("\n"),
			path: "src/test-support/relay.ts",
		}),
	],
	function* ({ check }) {
		expect(yield* check(rawServers)).toEqual([]);
	},
);

ruleCases.it(
	"tests/raw-servers accepts a test-support file that only imports node:http types",
	[
		repository.has({
			content:
				'import type { IncomingMessage, Server } from "node:http";\nexport const listen = (server: Server, request: IncomingMessage) => server.listen(0);',
			path: "src/test-support/types.ts",
		}),
	],
	function* ({ check }) {
		expect(yield* check(rawServers)).toEqual([]);
	},
);

ruleCases.it(
	"tests/raw-servers accepts Effect's Node HTTP server layer and other libraries' servers in test-support",
	[
		repository.has({
			content: [
				'import { createServer } from "node:http";',
				'import { createServer as createVite } from "vite";',
				'import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";',
				'export const layer = NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 });',
				"const server = await createVite();",
				"server.listen();",
				'export const notifications = (pg: { listen: (channel: string) => void }) => pg.listen("notes");',
			].join("\n"),
			path: "src/test-support/host.ts",
		}),
	],
	function* ({ check }) {
		expect(yield* check(rawServers)).toEqual([]);
	},
);
