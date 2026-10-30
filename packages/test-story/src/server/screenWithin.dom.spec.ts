import { expect } from "vitest";
import { scopedScreen } from "#test/scopedScreen.ts";

scopedScreen.it(
	"scopes identical controls and readouts by selector, role and element, including nested scopes",
	[],
	function* ({ within, text, delivery }) {
		expect(() => within("section")).toThrow('2 matches for "section"');
		expect(() => within({ name: /Billing|Delivery/u, role: "region" })).toThrow("2 matches for region");
		expect(() => within("article")).toThrow('0 matches for "article"');
		expect(() => within({ name: "Missing", role: "region" })).toThrow('0 matches for region named "Missing"');
		const billing = within('[aria-label="Billing"]');
		const address = within({ name: "Delivery", role: "region" }).within({ name: "Address", role: "form" });

		yield* billing.enter({ name: "City", role: "textbox" }, "London");
		yield* billing.click({ name: "Save", role: "button" });
		yield* address.enter("input", "Paris");
		yield* within(delivery()).submit();

		expect(billing.text("output")).toBe("London");
		expect(within(delivery()).text("output")).toBe("Paris");
		expect(address.value("input")).toBe("Paris");
		expect(address.accessible("button")).toEqual({ name: "Save", role: "button" });
		expect(address.accessible(yield* address.find("input"))).toEqual({ name: "City", role: "textbox" });
		yield* address.settle();
		expect(() => text("output")).toThrow('2 matches for "output"');
	},
);
