import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { hostPolicyStory } from "#test/hostPolicyStory.ts";

for (const role of ["worker", "reviewer"] as const) {
	describe(`host ${role} guidance`, () => {
		hostPolicyStory.it("caches text by modification time and rejects a removed file", [], function* (policy) {
			yield* policy.writeGuidance("Original approval.", 1000);
			const read = yield* policy.cachedGuidance(role);
			expect(yield* read).toBe("Original approval.");
			yield* policy.writeGuidance("Updated approval.", 1000);
			expect(yield* read).toBe("Original approval.");
			yield* policy.touchGuidance(2000);
			expect(yield* read).toBe("Updated approval.");
			yield* policy.removeGuidance();
			expect(yield* read.pipe(Effect.flip)).toMatchObject({ _tag: "HostFailure" });
		});
		for (const guidance of ["", { file: "" }, 17, { file: 3 }]) {
			hostPolicyStory.it(`rejects invalid guidance: ${JSON.stringify(guidance)}`, [], function* (policy) {
				const failure = yield* policy.prompt(role, guidance).pipe(Effect.flip);
				expect(failure).toMatchObject({ _tag: "HostFailure" });
				expect(failure.message).toContain("is invalid:");
			});
		}
		hostPolicyStory.it(`passes inline repository guidance from configuration to the ${role} prompt`, [], function* (policy) {
			const guidance = "Inspect the synthetic workflow.\nConfirm database tests are enabled.";
			expect(yield* policy.prompt(role, guidance)).toContain(guidance);
		});
		hostPolicyStory.it("reads a guidance file relative to the Board folder", [], function* (policy) {
			const guidance = "Confirm the synthetic integration checks passed.";
			expect(yield* policy.prompt(role, { file: `${role}.md` }, { [`${role}.md`]: guidance })).toContain(guidance);
		});
		hostPolicyStory.it(`omitted guidance leaves the ${role} prompt repository-independent`, [], function* (policy) {
			const prompt = yield* policy.prompt(role);
			expect(prompt).not.toContain(`Repository ${role} guidance:`);
			expect(prompt).not.toContain("pnpm db:setup");
			expect(prompt).not.toContain("_TEST_DATABASE_URL");
			expect(prompt).not.toContain("script/lib/postgresTestEnvironment.ts");
		});
		hostPolicyStory.it("an unreadable guidance file fails host policy creation", [], function* (policy) {
			const failure = yield* policy.prompt(role, { file: "missing.md" }).pipe(Effect.flip);
			expect(failure).toMatchObject({ _tag: "HostFailure" });
			expect(failure.message).toContain(`Fleet ${role} guidance is missing or unreadable: `);
			expect(failure.message).toMatch(/missing\.md$/u);
		});
	});
}
