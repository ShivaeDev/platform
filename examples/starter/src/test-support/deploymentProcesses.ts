import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { authPost, credentials } from "./authHttp.ts";
import { deployChild } from "./deployChild.ts";
import { watchBackends } from "./watchBackends.ts";

export function deploymentProcesses(tell: (line: string) => void) {
	return {
		health: (address: string) => Effect.promise(() => fetch(`${address}/health`)),
		signInAt: (address: string, name: string) => {
			tell(`${name} signs in over HTTP`);
			return authPost(address, "sign-in/email", credentials(name));
		},
		signUpAt: (address: string, name: string) => authPost(address, "sign-up/email", credentials(name)),
		startProcess: Effect.fn("DeploymentStory.startProcess")(function* (kind: "worker" | "web" | "migrate", port = 0, env?: Record<string, string>) {
			tell(`start the ${kind} process`);
			const database = yield* PostgresTestDatabase;
			return yield* deployChild(kind, database.url, port, env).pipe(Effect.provide(NodeServices.layer));
		}),
		watchBackends,
	};
}
