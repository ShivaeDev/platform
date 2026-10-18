import { expect } from "vitest";
import { adminSetup } from "#test-support/adminSetup.ts";

adminSetup.it("an upgraded app can bootstrap its first admin with the command and sign in", [], function* ({ upgradeAuth, createAdmin, signIn }) {
	yield* upgradeAuth();
	const bootstrap = yield* createAdmin("first-admin@app.test", "first-admin-password-123");
	expect(bootstrap.code, bootstrap.output + bootstrap.errors).toBe(0);
	expect(yield* signIn("first-admin@app.test", "first-admin-password-123")).toMatchObject({
		body: { user: { email: "first-admin@app.test", name: "Administrator", role: "admin" } },
		status: 200,
	});
	const duplicate = yield* createAdmin("first-admin@app.test", "another-admin-password-123");
	expect(duplicate.code).not.toBe(0);
});
