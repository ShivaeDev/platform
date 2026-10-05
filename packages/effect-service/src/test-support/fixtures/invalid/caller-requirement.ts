import { Context } from "effect";
import type { ServiceRequirements } from "#service-requirements.ts";

class Declared extends Context.Service<Declared, object>()("invalid/Declared") {}
class Secret extends Context.Service<Secret, object>()("invalid/Secret") {}

type InvalidCallerRequirement = ServiceRequirements<readonly [typeof Declared], void, never, Secret>;

export declare const invalid: InvalidCallerRequirement;
