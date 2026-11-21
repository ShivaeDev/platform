import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { failedEmailDelivery } from "#test-support/admin/failedEmailDelivery.ts";
import { foundationAccount, foundationAdmin, foundationPasswordAccount } from "#test-support/admin/foundation.ts";

for (const role of ["admin", "owner"] as const) {
	foundationAdmin.it(`an ${role}'s default session may manage sessions`, [foundationAccount("operator", role)], function* ({ permissions }) {
		const granted = yield* permissions("operator");

		expect(granted).toContain("sessions.manage");
	});
}

foundationAdmin.it("an admin sees the auth-email and session-sweep queues", [foundationAccount("operator", "admin")], function* ({ jobQueues }) {
	const queues = yield* jobQueues("operator");

	expect(queues).toEqual(expect.arrayContaining(["email.auth-emails", "sweep-expired-auth-sessions"]));
});

foundationAdmin.it(
	"an admin inspects a failed password-reset email through Jobs administration",
	[foundationAccount("operator", "admin"), failedEmailDelivery],
	function* ({ failedJobs, jobDetail, requestsPasswordReset, workersFinish }) {
		expect(yield* failedJobs("operator", "email.auth-emails")).toEqual([]);

		yield* requestsPasswordReset("operator");
		yield* workersFinish();

		const jobs = yield* failedJobs("operator", "email.auth-emails");
		expect(jobs).toMatchObject([{ data: { kind: "ResetPassword", to: "operator@app.test" }, state: "failed" }]);
		if (typeof jobs === "string" || jobs[0] === undefined) {
			return yield* Effect.die("The failed email did not reach Jobs administration");
		}
		expect(yield* jobDetail("operator", "email.auth-emails", jobs[0].id)).toMatchObject({
			data: { kind: "ResetPassword", to: "operator@app.test" },
			output: { message: "Resend could not deliver the email" },
			queue: "email.auth-emails",
			state: "failed",
		});
	},
);

foundationAdmin.it(
	"an admin reads failed password-reset and email-change emails with their links masked",
	[foundationAccount("operator", "admin"), foundationPasswordAccount("alice"), failedEmailDelivery],
	function* ({ failedJobs, jobDetail, requestsEmailChange, requestsPasswordReset, workersFinish }) {
		yield* requestsPasswordReset("alice");
		yield* requestsEmailChange("alice");
		yield* workersFinish();

		const jobs = yield* failedJobs("operator", "email.auth-emails");
		if (typeof jobs === "string") {
			return yield* Effect.die(`Jobs administration refused the failed emails: ${jobs}`);
		}
		expect(jobs.map(({ data }) => data).toSorted((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))).toEqual([
			{ kind: "ApproveEmailChange", newEmail: "alice-new@app.test", to: "alice@app.test", url: "<redacted>" },
			{ kind: "ResetPassword", to: "alice@app.test", url: "<redacted>" },
		]);
		for (const { id } of jobs) {
			expect(yield* jobDetail("operator", "email.auth-emails", id)).toMatchObject({ data: { url: "<redacted>" } });
		}
	},
);

foundationAdmin.it(
	"an admin reads the users and the job health of a fresh app",
	[foundationAccount("operator", "admin")],
	function* ({ jobHealth, users }) {
		const listed = yield* users("operator");

		yield* outcomes([
			["users", () => Effect.succeed(listed), ["operator@app.test"]],
			["job health", () => jobHealth("operator"), { active: 0, failed: 0 }],
		]);
	},
);

for (const [name, refused] of [
	["reader", "permission denied"],
	["visitor", "sign in required"],
] as const) {
	foundationAdmin.it(
		`users, job health and foundation job inspection answer ${name} with ${refused}`,
		[foundationAccount("reader")],
		function* ({ failedJobs, jobDetail, jobHealth, users }) {
			const listed = yield* users(name);

			yield* outcomes([
				["users", () => Effect.succeed(listed), refused],
				["job health", () => jobHealth(name), refused],
				["auth-email failures", () => failedJobs(name, "email.auth-emails"), refused],
				["session-sweep failures", () => failedJobs(name, "sweep-expired-auth-sessions"), refused],
				["auth-email detail", () => jobDetail(name, "email.auth-emails", "00000000-0000-4000-8000-000000000000"), refused],
				["session-sweep detail", () => jobDetail(name, "sweep-expired-auth-sessions", "00000000-0000-4000-8000-000000000000"), refused],
			]);
		},
	);
}
