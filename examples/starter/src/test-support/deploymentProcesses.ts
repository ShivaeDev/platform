import { NodeServices } from "@effect/platform-node";
import { Effect, Schedule } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { authPost, credentials } from "./authHttp.ts";
import { deployChild } from "./deployChild.ts";

export function deploymentProcesses(tell: (line: string) => void) {
	return {
		health: (url: string) => Effect.promise(() => fetch(`${url}/health`)),
		signUp: (url: string) => authPost(url, "sign-up/email", credentials("deploy")),
		startProcess: Effect.fn("DeploymentStory.startProcess")(function* (kind: "worker" | "web", port = 0) {
			tell(`start the ${kind} process`);
			const database = yield* PostgresTestDatabase;
			return yield* deployChild(kind, database.url, port).pipe(Effect.provide(NodeServices.layer));
		}),
		waitForWorkerSchemaCheck: Effect.gen(function* () {
			tell("wait for the worker to read the migration ledger");
			const sql = yield* SqlClient.SqlClient;
			yield* sql<{ checked: boolean }>`select exists (
				select 1 from pg_stat_activity
				where application_name = 'deploy_worker' and query like '%to_regclass%' and state = 'idle'
			) as checked`.pipe(
				Effect.repeat({ schedule: Schedule.spaced("10 millis"), times: 1000, until: ([row]) => row?.checked === true }),
				Effect.flatMap(([row]) => (row?.checked ? Effect.void : Effect.fail(new Error("The worker did not read its migration ledger")))),
			);
		}),
	};
}
