import { expect } from "vitest";
import { runtimeAcquisitionFails } from "#test/adapterRouter.ts";
import { declaredRejections } from "#test/declaredRejections.ts";
import { orderContracts } from "#test/orderContracts.ts";
import { profileInputs } from "#test/profileInputs.ts";
import { rejectionRules } from "#test/rejectionRules.ts";
import { trpc } from "#test/routerStory.ts";

for (const { name, trait, path } of [
	{ name: "declaredRejections", path: "explicit", trait: declaredRejections() },
	{ name: "orderContracts", path: "forget", trait: orderContracts() },
	{ name: "profileInputs", path: "constructed", trait: profileInputs() },
	{ name: "rejectionRules", path: "success", trait: rejectionRules() },
]) {
	trpc.it(`applies runtime acquisition failures to ${name}`, [trait, runtimeAcquisitionFails()], function* ({ rejectCaller, mapped }) {
		expect(yield* rejectCaller(path)).toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
		expect(mapped).toEqual([{ error: expect.objectContaining({ message: "private runtime acquisition detail" }), origin: "failure", path }]);
	});
}
