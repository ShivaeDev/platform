import {
	bakerIsCalledAway,
	bakery,
	hasDough,
	hasFlourDelivered,
	hasFlourFromTheMill,
	hasNoBowls,
	hasOatsFromTheMill,
	hasRyeFromTheMill,
	hasSpoiledYeast,
} from "#test/bakery.ts";

bakery.it("asks for more dough than its bowl holds", [hasDough(4)]);
bakery.it("asks the supplier for more flour than it delivers", [hasFlourDelivered(9)]);
bakery.it("waits for flour from a mill that fails with a string", [hasFlourFromTheMill()]);
bakery.it("waits for oats from a mill that fails with a plain object", [hasOatsFromTheMill()]);
bakery.it("waits for rye from a mill that fails with a tagged error that has fields", [hasRyeFromTheMill()]);
bakery.it("bakes with yeast that dies", [hasSpoiledYeast()]);
bakery.it("loses its baker to an interruption", [bakerIsCalledAway(), hasDough(1)]);
bakery.it("has a kitchen whose after hook finds no bowls", [hasNoBowls()]);
