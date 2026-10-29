import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	agreement,
	HELD_SLUG,
	nameLeftWhileDecoding,
	names,
	profiles,
	prototypeNamed,
	requiredName,
	serverNames,
	slowNames,
	slugs,
	visibility,
} from "#test/forms.ts";

requiredName.it("submitting an empty required name shows Required on the name", [], function* ({ feedbackOn, submit }) {
	expect(yield* feedbackOn("name")).toBeUndefined();

	yield* submit();

	expect(yield* feedbackOn("name")).toBe("Required");
});

requiredName.it(
	"submitting an empty required name is refused as invalid before it reaches the server",
	[],
	function* ({ saveOutcome, serverReceived, submit }) {
		yield* submit();

		yield* outcomes({
			"names the server received": [serverReceived(), []],
			save: [saveOutcome(), "invalid"],
		});
	},
);

serverNames.it("the server's rejection of a taken name shows on the name", [], function* ({ feedbackOn, submit }) {
	expect(yield* feedbackOn("name")).toBeUndefined();

	yield* submit();

	expect(yield* feedbackOn("name")).toBe("Already used");
});

serverNames.it("changing a rejected name clears the server's rejection", [serverNames.submitted()], function* ({ enter, feedbackOn }) {
	expect(yield* feedbackOn("name")).toBe("Already used");

	yield* enter("name", "grace");

	expect(yield* feedbackOn("name")).toBeUndefined();
});

serverNames.it(
	"resubmitting after changing a rejected name saves the new name",
	[serverNames.submitted(), serverNames.edited("name", "grace")],
	function* ({ saveOutcome, savedValue, submit }) {
		expect(yield* saveOutcome()).toBe("rejected on name: Already used");

		yield* submit();

		expect(yield* savedValue()).toBe("grace");
	},
);

visibility.it("a visibility field offers private and public", [], function* ({ choicesFor }) {
	expect(yield* choicesFor("visibility")).toEqual(["private", "public"]);
});

agreement.it("a yes/no field decoded to a boolean still offers yes and no", [], function* ({ choicesFor }) {
	expect(yield* choicesFor("agreed")).toEqual(["yes", "no"]);
});

prototypeNamed.it("a field named toString offers no choices", [], function* ({ choicesFor }) {
	expect(yield* choicesFor("toString")).toBeUndefined();
});

prototypeNamed.it("an empty field named toString shows Required after a submit", [], function* ({ feedbackOn, submit }) {
	expect(yield* feedbackOn("toString")).toBeUndefined();

	yield* submit();

	expect(yield* feedbackOn("toString")).toBe("Required");
});

slugs.it("a slug the runtime's slug service already holds is rejected on the slug and not on the title", [], function* ({ feedbackOn, submit }) {
	expect(yield* feedbackOn("slug")).toBeUndefined();

	yield* submit();

	yield* outcomes({
		slug: [feedbackOn("slug"), `"${HELD_SLUG}" is already in use`],
		title: [feedbackOn("title"), undefined],
	});
});

names.it("typing the starting name back leaves nothing unsaved", [names.edited("name", "Ops")], function* ({ enter, unsavedChanges }) {
	expect(yield* unsavedChanges()).toBe(true);

	yield* enter("name", "First");

	expect(yield* unsavedChanges()).toBe(false);
});

slowNames.it(
	"an empty name left during its slow decode shows Required only once the decode finishes",
	[nameLeftWhileDecoding()],
	function* ({ feedbackOn, finishDecode }) {
		expect(yield* feedbackOn("name")).toBeUndefined();

		yield* finishDecode();

		expect(yield* feedbackOn("name")).toBe("Required");
	},
);

profiles.it("a view mapped from the profile shows the label the server sends", [], function* ({ labelView, refresh }) {
	expect(yield* labelView()).toBe("First");

	yield* refresh({ profile: { count: 5, label: "Received" } });

	expect(yield* labelView()).toBe("Received");
});

profiles.it(
	"counting the profile up after a refresh starts from the refreshed count",
	[profiles.refreshReceived({ profile: { count: 5, label: "Received" } })],
	function* ({ countUp, shown }) {
		expect(yield* shown("profile")).toEqual({ count: 5, label: "Received" });

		yield* countUp();

		expect(yield* shown("profile")).toEqual({ count: 6, label: "Received" });
	},
);

profiles.it.fails(
	"BUG: setting the profile count through the field's count prop shows the new count",
	[],
	function* ({ setCountThroughProp, shown }) {
		expect(yield* shown("profile")).toEqual({ count: 1, label: "First" });

		yield* setCountThroughProp(2);

		expect(yield* shown("profile")).toEqual({ count: 2, label: "First" });
	},
);
