import { expect } from "vitest";
import { authWritesStory, bobSignedOut, listsOpen } from "#test/authWritesStory.ts";

authWritesStory.it(
	"an open users list shows bob after he signs up and after he renames himself through Better Auth",
	[listsOpen],
	function* ({ changesName, shown, signsUp, untilRefreshed }) {
		expect(yield* shown("users")).toEqual([]);

		yield* signsUp("bob");
		yield* untilRefreshed("users");

		expect(yield* shown("users")).toEqual(["bob"]);

		yield* changesName("bob", "Robert");
		yield* untilRefreshed("users");

		expect(yield* shown("users")).toEqual(["Robert"]);
	},
);

authWritesStory.it(
	"an open sessions list shows bob's sign-in and drops his session at sign-out",
	[bobSignedOut, listsOpen],
	function* ({ shown, signsIn, signsOut, untilRefreshed }) {
		expect(yield* shown("sessions")).toEqual([]);

		yield* signsIn("bob");
		yield* untilRefreshed("sessions");

		expect(yield* shown("sessions")).toEqual(["bob"]);

		yield* signsOut("bob");
		yield* untilRefreshed("sessions");

		expect(yield* shown("sessions")).toEqual([]);
	},
);
