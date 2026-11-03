import { expect } from "vitest";
import { snapshotStorage } from "#test/storageStory.ts";
import { typedMigrationRecords } from "#test/typedMigrationRecords.ts";

const [VALUE] = typedMigrationRecords();
if (VALUE === undefined) {
	throw new Error("Missing populated fixture");
}
const CHANGE = { attempts: [], history: [], prompt: "changed" };

snapshotStorage.it(
	"a records read returns one version of a record while a writer replacing its fields and children waits for it",
	[],
	function* ({ heldSnapshotRead, inBackground, migrate, openFleetStorage, writerWaitsForSnapshot }) {
		const namespace = "typed_snapshot";
		const fleet = yield* openFleetStorage({ namespace });
		yield* migrate(namespace);
		const saved = yield* fleet.insert(VALUE);
		const read = yield* heldSnapshotRead(namespace, VALUE.workId, "records");
		const write = yield* inBackground(fleet.replace(VALUE.workId, saved.version, { ...saved.value, ...CHANGE }));
		yield* writerWaitsForSnapshot();

		yield* read.resume();

		expect(yield* read.result()).toEqual(saved.value);
		const updated = yield* write.result();
		expect(yield* fleet.reload(VALUE.workId)).toEqual(updated);
	},
);

snapshotStorage.it(
	"a receipt snapshot returns one committed version of a record while an admission writer saves without waiting",
	[],
	function* ({ heldSnapshotRead, migrate, openFleetStorage }) {
		const namespace = "receipt_snapshot";
		const fleet = yield* openFleetStorage({ namespace });
		yield* migrate(namespace);
		const saved = yield* fleet.insert(VALUE);
		const read = yield* heldSnapshotRead(namespace, VALUE.workId, "receipt");

		const updated = yield* fleet.replace(VALUE.workId, saved.version, { ...saved.value, ...CHANGE });

		yield* read.resume();
		const snapshot = yield* read.result();
		expect(snapshot).toEqual(saved.value);
		expect(yield* fleet.reload(VALUE.workId)).toEqual(updated);
	},
);
