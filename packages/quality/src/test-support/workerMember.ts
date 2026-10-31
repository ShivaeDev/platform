import type { Fixture } from "./fixtureTree.ts";

export function workerMember(bin: unknown): Fixture {
	return {
		files: [
			{ content: '{"workspaces":["modules/*"]}', path: "package.json" },
			{ content: '{"name":"app"}', path: "modules/app/package.json" },
			{
				content: JSON.stringify({ bin, engines: { node: ">=24" }, exports: { "./api.ts": "./src/api.ts" }, name: "worker" }),
				path: "modules/worker/package.json",
			},
			{ content: 'import type { Api } from "worker/api.ts";\nexport * from "../../../worker/src/cli.ts";', path: "modules/app/src/client/app.ts" },
			{ content: 'export * from "worker/api.ts";', path: "modules/app/src/shared.ts" },
			{ content: 'import "worker/api.ts";', path: "modules/app/src/server/app.ts" },
			{ content: "export type Api = string;", path: "modules/worker/src/api.ts" },
			{ content: 'import "node:fs";', path: "modules/worker/src/cli.ts" },
		],
		story: `a workspace whose member worker declares engines.node and the bin ${JSON.stringify(bin)}, imported by the member app from client, shared and server code`,
	};
}
