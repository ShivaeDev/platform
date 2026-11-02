import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { rejectedProfiles, unavailableProfiles, unmappedProfiles } from "#test/fieldRejections.ts";

rejectedProfiles.it("a save's mapped rejection appears on the nested name and leaves its sibling clear", [], function* ({ feedbackAt, submit }) {
	expect(yield* feedbackAt(["profile", "name"])).toBeUndefined();

	yield* submit();

	yield* outcomes([
		["name feedback", () => feedbackAt(["profile", "name"]), "Name is already used"],
		["email feedback", () => feedbackAt(["profile", "email"]), undefined],
	]);
});

unmappedProfiles.it("a rejection naming no form field stays a save failure", [], function* ({ failure, feedbackOn, submit }) {
	yield* submit();

	yield* outcomes([
		["save failure", () => failure(), "conflict on name: Name is already used"],
		["profile feedback", () => feedbackOn("profile"), undefined],
	]);
});

unavailableProfiles.it("an unavailable save retains its error and shows no field rejection", [], function* ({ failure, feedbackOn, submit }) {
	yield* submit();

	yield* outcomes([
		["save failure", () => failure(), "unavailable: Directory is offline"],
		["profile feedback", () => feedbackOn("profile"), undefined],
	]);
});
