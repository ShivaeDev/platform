import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import type { ScreenTarget } from "#screenDriver.ts";
import { refusalOf } from "#test/attempt.ts";
import { scopedScreen } from "#test/scopedScreen.ts";

const unclearScopes: readonly (readonly [string, ScreenTarget, string])[] = [
	["two sections by selector", "section", 'threw: The screen has 2 matches for "section".'],
	["two regions by role", { name: /Billing|Delivery/u, role: "region" }, "threw: The screen has 2 matches for region named /Billing|Delivery/u."],
	["no article by selector", "article", 'threw: The screen has 0 matches for "article".'],
	["no Missing region by role", { name: "Missing", role: "region" }, 'threw: The screen has 0 matches for region named "Missing".'],
];

for (const [scope, container, refused] of unclearScopes) {
	scopedScreen.it(`refuses a scope matching ${scope}`, [], function* ({ within }) {
		expect(yield* refusalOf(() => within(container))).toBe(refused);
	});
}

scopedScreen.it("saves the Billing city through a selector scope without touching Delivery", [], function* ({ within, savedCity }) {
	const billing = within('[aria-label="Billing"]');
	yield* outcomes({ "the Billing city": [savedCity("Billing"), "Unsaved"], "the Delivery city": [savedCity("Delivery"), "Unsaved"] });

	yield* billing.enter({ name: "City", role: "textbox" }, "London");
	yield* billing.click({ name: "Save", role: "button" });

	yield* outcomes({ "the Billing city": [savedCity("Billing"), "London"], "the Delivery city": [savedCity("Delivery"), "Unsaved"] });
});

scopedScreen.it("enters the Delivery city through nested role scopes", [], function* ({ within, enteredCity }) {
	const address = within({ name: "Delivery", role: "region" }).within({ name: "Address", role: "form" });
	yield* outcomes({ "the Billing field": [enteredCity("Billing"), ""], "the Delivery field": [enteredCity("Delivery"), ""] });

	yield* address.enter("input", "Paris");

	yield* outcomes({ "the Billing field": [enteredCity("Billing"), ""], "the Delivery field": [enteredCity("Delivery"), "Paris"] });
});

scopedScreen.it("submits the Delivery form through an element scope", [], function* ({ within, deliverySection, savedCity }) {
	const delivery = within(deliverySection());
	yield* delivery.enter("input", "Paris");
	expect(yield* savedCity("Delivery")).toBe("Unsaved");

	yield* delivery.submit();

	yield* outcomes({ "the Billing city": [savedCity("Billing"), "Unsaved"], "the Delivery city": [savedCity("Delivery"), "Paris"] });
});

scopedScreen.it("finds the one City field inside a nested scope", [], function* ({ within }) {
	const address = within({ name: "Delivery", role: "region" }).within({ name: "Address", role: "form" });

	const city = yield* address.find("input");

	expect(address.accessible(city)).toEqual({ name: "City", role: "textbox" });
});

scopedScreen.it("keeps the unscoped screen seeing both outputs after scoping", [], function* ({ within, text }) {
	within('[aria-label="Billing"]');

	expect(yield* refusalOf(() => text("output"))).toBe('threw: The screen has 2 matches for "output".');
});
