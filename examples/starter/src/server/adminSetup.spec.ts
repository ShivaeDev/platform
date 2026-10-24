import { expect } from "vitest";
import { adminSetup } from "#test-support/adminSetup.ts";

const SUCCESSFUL_EXIT = 0;
const OK_STATUS = 200;

adminSetup.it(
	"a new app can bootstrap its first admin with the command and sign in",
	[],
	function* ({ prepareAuth, createAdmin, startApp, signIn, session }) {
		yield* prepareAuth();
		const bootstrap = yield* createAdmin("first-admin@app.test", "first-admin-password-123");
		expect(bootstrap.code, bootstrap.output + bootstrap.errors).toBe(SUCCESSFUL_EXIT);
		yield* startApp();
		expect((yield* signIn("first-admin@app.test", "first-admin-password-123")).status).toBe(OK_STATUS);
		expect(yield* session()).toMatchObject({
			user: { email: "first-admin@app.test", name: "Administrator", role: "admin" },
		});
		const duplicate = yield* createAdmin("first-admin@app.test", "another-admin-password-123");
		expect(duplicate.code).not.toBe(SUCCESSFUL_EXIT);
	},
);
