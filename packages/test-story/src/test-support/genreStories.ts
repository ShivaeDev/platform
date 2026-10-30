import { bakery, ovenIsLit } from "#test/bakery.ts";
import { mill, sailsAreTurning } from "#test/mill.ts";

bakery.it("lights the oven", [ovenIsLit()]);

mill.it("turns the sails", [sailsAreTurning()]);
