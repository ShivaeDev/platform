import { expect } from "vitest";
import { sharedLists, signedInMembers } from "#test/sharedListScreen.ts";

sharedLists.it(
	"ada and grace share list changes while keeping their own drafts and cookie sessions",
	[signedInMembers("ada", "grace")],
	function* ({ as }) {
		expect(as("ada").text("output")).toBe("ada's list: ");
		expect(as("grace").text("output")).toBe("grace's list: ");
		yield* as("ada").enter("input", "Bread");
		yield* as("grace").enter("input", "Milk");

		yield* as("ada").submit();
		yield* as("ada").settle();
		yield* as("grace").click({ name: "Refresh", role: "button" });
		yield* as("grace").settle();

		expect(as("grace").text("output")).toBe("grace's list: ada: Bread");
		expect(as("grace").value("input")).toBe("Milk");

		yield* as("grace").submit();
		yield* as("grace").settle();
		yield* as("ada").click({ name: "Refresh", role: "button" });
		yield* as("ada").settle();

		expect(as("ada").text("output")).toBe("ada's list: ada: Bread, grace: Milk");

		yield* as("ada").click({ name: "Sign out", role: "button" });
		yield* as("ada").settle();
		yield* as("grace").click({ name: "Refresh", role: "button" });
		yield* as("grace").settle();

		expect(as("ada").text("output")).toBe("Signed out");
		expect(as("grace").text("output")).toBe("grace's list: ada: Bread, grace: Milk");
	},
);

sharedLists.it(
	"closing the members' Scope removes every root and disposes every atom registry",
	[signedInMembers("ada", "grace")],
	function* ({ attachedRoots, closeMembers, readDraft }) {
		expect(attachedRoots()).toEqual(["ada", "grace"]);
		expect(readDraft("ada")).toBe("");
		expect(readDraft("grace")).toBe("");

		yield* closeMembers();

		expect(attachedRoots()).toEqual([]);
		expect(() => readDraft("ada")).toThrow("registry is disposed");
		expect(() => readDraft("grace")).toThrow("registry is disposed");
	},
);
