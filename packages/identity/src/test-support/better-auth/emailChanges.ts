import { Effect, Redacted } from "effect";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { changeEmail } from "#client/adapters/changeEmail.ts";
import { emailChangeHost } from "./emailChangeHost.ts";
import { CURRENT_PASSWORD } from "./hardeningHost.ts";

export const emailChanges = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	create: emailChangeHost,
	layer: postgres,
	name: "typed email changes behind bearer sessions for alice's verified password account",
	runIf: databaseUrl !== undefined,
	stages: [],
	verbs: ({ client, messages }, story) => ({
		approvalMessages: () => Effect.sync(() => messages.filter((message) => message._tag === "ApproveEmailChange")),
		changeEmail: (password = CURRENT_PASSWORD) => {
			story.tell("alice requests an email change through identity's typed client call using her signed bearer session");
			return changeEmail(client)({ newEmail: "alice-new@example.test", password });
		},
		followApprovalLink: () =>
			Effect.promise(async () => {
				story.tell("alice follows her emailed approval link in the browser");
				const message = messages.find((mail) => mail._tag === "ApproveEmailChange");
				if (message === undefined) {
					throw new Error("No approval email reached alice");
				}
				const response = await fetch(Redacted.value(message.url), { redirect: "manual" });
				return { body: await response.text(), location: response.headers.get("location"), status: response.status };
			}),
	}),
});
