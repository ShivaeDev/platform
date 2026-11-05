import { Context } from "effect";
export class JobQueues extends Context.Service<JobQueues, readonly string[]>()("@shivaedev/jobs/JobQueues") {}
