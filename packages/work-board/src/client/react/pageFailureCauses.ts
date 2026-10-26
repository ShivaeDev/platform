import { Cause } from "effect";
import { Conflict, NotFound, ServiceUnavailable } from "@shivaedev/effect-contract/errors/taxonomy.ts";

export const pageFailureCauses = {
	conflict: Cause.fail(new Conflict({ message: "The handoff source is unavailable." })),
	notFound: Cause.fail(new NotFound({ message: "The page is missing." })),
	unavailable: Cause.fail(new ServiceUnavailable({ message: "The workspace is unavailable." })),
};
