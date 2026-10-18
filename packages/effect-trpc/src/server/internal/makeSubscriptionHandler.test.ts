import { expect } from "vitest";
import { adapterServices } from "#test/adapterRouter.ts";
import { trpc } from "#test/routerStory.ts";

trpc.it("redacts request Layer defects while mapping the subscription cause", [adapterServices()], function* ({ subscribe, rejectNext, mapped }) {
	const iterator = yield* subscribe("events");
	expect(yield* rejectNext(iterator)).toMatchObject({ code: "INTERNAL_SERVER_ERROR", message: "Internal server error" });
	expect(mapped).toEqual([{ error: expect.any(Error), origin: "defect", path: "events" }]);
});
