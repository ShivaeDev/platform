import { expect } from "vitest";
import { scopedSessions, sessionScreens } from "#test/sessionStories.ts";

sessionScreens.it(
	"private keys stay with an unchanged generation and are discarded on account replacement, sign-out and same-account re-entry",
	[scopedSessions()],
	function* ({ scoped, showScoped, renameScoped, observe }) {
		const { view, host } = scoped();
		const onePrivateStream = 1;
		const oneGeneration = 1;
		const threeGenerations = 3;
		yield* showScoped({ id: "alice-1", token: "alice-token" });
		yield* observe("Alice's private query is live", () => {
			expect(view.text()).toBe("First");
			expect(host.state.active).toBe(onePrivateStream);
		});
		const alice = view.connections[0];
		yield* showScoped({ id: "alice-1", token: "alice-token" });
		expect(view.connections).toHaveLength(oneGeneration);
		expect(view.text()).toBe("First");
		yield* showScoped({ id: "bob-1", token: "bob-token" });
		yield* observe("Bob owns the only private stream", () => {
			expect(view.text()).toBe("Bob note");
			expect(host.state.active).toBe(onePrivateStream);
		});
		expect(alice?.registry.getNodes().size).toBe(0);
		yield* renameScoped("Alice changed while away");
		expect(view.text()).toBe("Bob note");
		yield* showScoped(undefined);
		yield* observe("sign-out releases Bob's private stream", () => expect(host.state.active).toBe(0));
		expect(view.connections[1]?.registry.getNodes().size).toBe(0);
		expect(view.text()).toBe("Signed out");
		yield* showScoped({ id: "alice-2", token: "alice-token" });
		yield* observe("Alice re-enters with a fresh private read", () => {
			expect(view.text()).toBe("Alice changed while away");
			expect(host.state.active).toBe(onePrivateStream);
		});
		expect(view.connections).toHaveLength(threeGenerations);
		expect(view.connections[2]?.registry).not.toBe(alice?.registry);
	},
);
