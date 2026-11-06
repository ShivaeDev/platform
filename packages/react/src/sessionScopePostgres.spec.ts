import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { privateSaveCommitted, privateSaveHeld, privateSessionsAcrossHosts, processes } from "#test/postgres-example/processKit.ts";

processes.it(
	"a private commit reaches Alice's clients on both hosts once, after it commits",
	[privateSaveHeld()],
	function* ({ privateDeliveries, privateSaves, releasePrivateCommit }) {
		yield* releasePrivateCommit();

		yield* outcomes([
			["reader", () => privateDeliveries("reader"), ["result: Private title / Private title"]],
			["saves", () => privateSaves(), ["saved"]],
			["writer", () => privateDeliveries("writer"), ["result: Private title / Private title"]],
		]);
	},
);

processes.it(
	"shared preference hints leave Bob reading only his own data",
	[privateSaveCommitted()],
	function* ({ bobSaves, privateDeliveries, privateRead }) {
		yield* bobSaves("Bob's title");

		yield* outcomes([
			["Bob reads", () => privateRead("bob"), "Unset"],
			["Bob's deliveries", () => privateDeliveries("bob"), ["unchanged: Unset / Unset", "unchanged: Unset / Unset"]],
		]);
	},
);

processes.it(
	"a rolled-back private write sends no hint to either host",
	[privateSessionsAcrossHosts()],
	function* ({ privateDeliveries, privateSave, privateSaves, rejectedPrivateSave }) {
		yield* rejectedPrivateSave("Rolled back");
		yield* privateSave("After rollback");

		yield* outcomes([
			["reader", () => privateDeliveries("reader"), ["result: After rollback / After rollback"]],
			["saves", () => privateSaves(), ["rejected as Rejected", "saved"]],
			["writer", () => privateDeliveries("writer"), ["result: After rollback / After rollback"]],
		]);
	},
);
