import { daemonResync } from "#test/daemonResync.ts";
import { withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("live");

test("a change-listener resync rereads committed state after a missed hint", () => withHost({}, {}, daemonResync));
