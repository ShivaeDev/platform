import { expect } from "@effect/vitest";
import { serviceParameters } from "#rules/effect/serviceParameters.ts";
import { effectResolves } from "#test/effectPolicyFiles.ts";
import { hostServicesResolve } from "#test/hostServicesResolve.ts";
import { repositoryHas, ruleStory } from "#test/ruleStory.ts";

for (const borrowed of [false, true]) {
	ruleStory.it(
		`service parameters ${borrowed ? "rejects an environment request beside" : "accepts"} Node requests received through a host callback`,
		[
			effectResolves(),
			...hostServicesResolve(),
			repositoryHas({
				content: `import { createServer, type IncomingMessage } from "node:http";
import * as NodeSocketServer from "@effect/platform-node/NodeSocketServer";
import { Effect } from "effect";
function inspect(request: IncomingMessage) { return Effect.succeed(request.url); }
function forward(request: IncomingMessage) { return inspect(request); }
createServer((request, response) => { void forward(request); response.end(); });
${borrowed ? "export const borrowed = Effect.gen(function* () { return yield* forward(yield* NodeSocketServer.IncomingMessage); });" : "export const tag = NodeSocketServer.IncomingMessage;"}`,
				path: "src/adapters/http.ts",
			}),
		],
		function* ({ check }) {
			const findings = yield* check(serviceParameters);

			expect(findings).toEqual(
				borrowed
					? [
							expect.objectContaining({
								file: "src/adapters/http.ts",
								line: 4,
								message: expect.stringContaining("Parameter request carries a service."),
							}),
							expect.objectContaining({
								file: "src/adapters/http.ts",
								line: 5,
								message: expect.stringContaining("Parameter request carries a service."),
							}),
						]
					: [],
			);
		},
	);
}
