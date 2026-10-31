import { describe, expect } from "@effect/vitest";
import { hostPolicyStory } from "#test/hostPolicyStory.ts";
import { refusal } from "#test/refusal.ts";

for (const role of ["worker", "reviewer"] as const) {
	describe(`host ${role} guidance`, () => {
		hostPolicyStory.it("an edit that keeps the modification time leaves the cached guidance in place", [], function* (policy) {
			yield* policy.writeGuidance("Original approval.", 1000);
			const read = yield* policy.cachedGuidance(role);
			expect(yield* read).toBe("Original approval.");

			yield* policy.writeGuidance("Updated approval.", 1000);

			expect(yield* read).toBe("Original approval.");
		});

		hostPolicyStory.it("a newer modification time rereads the guidance", [], function* (policy) {
			yield* policy.writeGuidance("Original approval.", 1000);
			const read = yield* policy.cachedGuidance(role);
			expect(yield* read).toBe("Original approval.");
			yield* policy.writeGuidance("Updated approval.", 1000);

			yield* policy.touchGuidance(2000);

			expect(yield* read).toBe("Updated approval.");
		});

		hostPolicyStory.it("removing the cached guidance file fails the next read as a host failure", [], function* (policy) {
			yield* policy.writeGuidance("Original approval.", 1000);
			const read = yield* policy.cachedGuidance(role);
			expect(yield* read).toBe("Original approval.");

			yield* policy.removeGuidance();

			expect(yield* refusal(read)).toMatch(/^host failure: /u);
		});

		for (const guidance of ["", { file: "" }, 17, { file: 3 }]) {
			hostPolicyStory.it(`invalid guidance ${JSON.stringify(guidance)} is refused as invalid`, [], function* (policy) {
				const prompt = yield* refusal(policy.prompt(role, guidance));

				expect(prompt).toMatch(/^host failure: .*is invalid:/u);
			});
		}

		hostPolicyStory.it(`inline repository guidance from configuration reaches the ${role} prompt`, [], function* (policy) {
			const guidance = "Inspect the synthetic workflow.\nConfirm database tests are enabled.";

			const prompt = yield* policy.prompt(role, guidance);

			expect(prompt).toContain(guidance);
		});

		hostPolicyStory.it("a guidance file is read relative to the Board folder", [], function* (policy) {
			const guidance = "Confirm the synthetic integration checks passed.";

			const prompt = yield* policy.prompt(role, { file: `${role}.md` }, { [`${role}.md`]: guidance });

			expect(prompt).toContain(guidance);
		});

		hostPolicyStory.it(`omitted guidance leaves the ${role} prompt repository-independent`, [], function* (policy) {
			const prompt = yield* policy.prompt(role);

			for (const repositoryText of [`Repository ${role} guidance:`, "pnpm db:setup", "_TEST_DATABASE_URL", "script/lib/postgresTestEnvironment.ts"]) {
				expect(prompt).not.toContain(repositoryText);
			}
		});

		hostPolicyStory.it("an unreadable guidance file fails host policy creation and names the file", [], function* (policy) {
			const prompt = yield* refusal(policy.prompt(role, { file: "missing.md" }));

			expect(prompt).toMatch(new RegExp(`^host failure: Fleet ${role} guidance is missing or unreadable: .*missing\\.md$`, "u"));
		});
	});
}
