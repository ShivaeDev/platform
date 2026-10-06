import { expect } from "@effect/vitest";
import { bakery, ovenIsLit } from "#test/bakery.ts";
import { mill, sailsAreTurning } from "#test/mill.ts";

bakery.it("a lit oven stays lit", [ovenIsLit()], ({ story }) => {
	expect(story.engine.ovenLit).toBe(true);
});

mill.it("turning sails keep turning", [sailsAreTurning()], ({ story }) => {
	expect(story.engine.sails).toBe("turning");
});
