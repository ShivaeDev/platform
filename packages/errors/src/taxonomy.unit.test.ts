import { expect, it } from "vitest";
import * as Taxonomy from "#taxonomy.ts";

const cases = [
	[Taxonomy.NotFound, Taxonomy.isNotFound],
	[Taxonomy.Unauthorized, Taxonomy.isUnauthorized],
	[Taxonomy.Forbidden, Taxonomy.isForbidden],
	[Taxonomy.BadRequest, Taxonomy.isBadRequest],
	[Taxonomy.Conflict, Taxonomy.isConflict],
	[Taxonomy.PreconditionFailed, Taxonomy.isPreconditionFailed],
	[Taxonomy.TooManyRequests, Taxonomy.isTooManyRequests],
	[Taxonomy.AuthUnavailable, Taxonomy.isAuthUnavailable],
	[Taxonomy.InternalServerError, Taxonomy.isInternalServerError],
	[Taxonomy.ServiceUnavailable, Taxonomy.isServiceUnavailable],
] as const;

for (const [ErrorClass, guard] of cases) {
	it(`${ErrorClass.name}'s guard accepts its instance and rejects tagged look-alikes and other classes`, () => {
		const error = new ErrorClass({ message: "failure" });
		expect(guard(error)).toBe(true);
		expect(guard({ ...error })).toBe(false);
		for (const [OtherClass] of cases) {
			if (OtherClass !== ErrorClass) {
				expect(guard(new OtherClass({ message: "failure" }))).toBe(false);
			}
		}
	});
}
