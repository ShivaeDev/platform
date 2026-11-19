import { expect } from "vitest";
import { bucketRegistration, serverReports } from "#test/bucketRegistration.ts";

for (const buckets of ["a single-column bucket", "a tuple bucket"] as const) {
	bucketRegistration.it(
		`registration of a repository with ${buckets} refuses PostgreSQL 16.4 before any write, naming both versions and RETURNING old`,
		[serverReports("16.4", "160004")],
		function* ({ registerWith, registration }) {
			yield* registerWith(buckets);

			expect(yield* registration()).toBe(
				"BucketWriteVersionError: Bucketed writes to bucket_version require PostgreSQL 18 or later because they read each row's previous bucket with RETURNING old; the database reports PostgreSQL 16.4",
			);
		},
	);

	bucketRegistration.it(`a repository with ${buckets} registers on the PostgreSQL 18 test server`, [], function* ({ registerWith, registration }) {
		yield* registerWith(buckets);

		expect(yield* registration()).toBe("registered");
	});
}

bucketRegistration.it(
	"a repository with no buckets registers on PostgreSQL 16.4",
	[serverReports("16.4", "160004")],
	function* ({ registerWith, registration }) {
		yield* registerWith("no buckets");

		expect(yield* registration()).toBe("registered");
	},
);
