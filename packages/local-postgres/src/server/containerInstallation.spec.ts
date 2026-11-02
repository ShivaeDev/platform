import { expect } from "vitest";
import { connections } from "#test/connections.ts";

connections.it("setup installs a writable persistent data volume at /var/lib/postgresql", [], function* ({ dataMount, start }) {
	yield* start();

	expect(yield* dataMount()).toBe("volume development-postgres -> /var/lib/postgresql (writable: true)");
});

connections.it("setup publishes PostgreSQL's port only on IPv4 loopback", [], function* ({ publishedPort, start }) {
	yield* start();

	expect(yield* publishedPort()).toMatch(/^127\.0\.0\.1:[1-9]\d* -> 5432\/tcp$/u);
});
