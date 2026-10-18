import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { authPost, credentials } from "./authHttp.ts";
import { deployChild } from "./deployChild.ts";

export function deploymentProcesses(tell: (line: string) => void) {
	return {
		health: (address: string) => Effect.promise(() => fetch(`${address}/health`)),
		signUpAt: (address: string, name: string) => authPost(address, "sign-up/email", credentials(name)),
		startProcess: Effect.fn("DeploymentStory.startProcess")(function* (kind: "worker" | "web", port = 0) {
			tell(`start the ${kind} process`);
			const database = yield* PostgresTestDatabase;
			return yield* deployChild(kind, database.url, port).pipe(Effect.provide(NodeServices.layer));
		}),
	};
}
