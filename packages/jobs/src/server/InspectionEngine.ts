import { Context } from "effect";
import type { inspectionReads } from "#server/adapters/inspectionReads.ts";
export class InspectionEngine extends Context.Service<InspectionEngine, ReturnType<typeof inspectionReads>>()("@shivaedev/jobs/InspectionEngine") {}
