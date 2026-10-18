import type { FleetHost } from "#host/config.ts";
import { hostDatabase } from "#test/hostDatabase.ts";

export function readOnlySql(host: FleetHost) {
	return hostDatabase(host, "work-fleet-reader", 1);
}
