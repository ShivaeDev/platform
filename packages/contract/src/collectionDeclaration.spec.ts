import { expect } from "vitest";
import { collectionDeclarationStory } from "#test/collectionDeclarationStory.ts";

collectionDeclarationStory.it(
	"building a member contract refuses collection reads and explains the required permission policy",
	[],
	function* ({ buildMemberContract }) {
		expect(yield* buildMemberContract()).toBe(
			"Collection reads require a permission policy on query workspaces.all; use permissionReadPolicy instead of a member policy",
		);
	},
);
