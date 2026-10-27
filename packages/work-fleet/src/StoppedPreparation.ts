import { Schema } from "effect";

export const StoppedPreparation = Schema.Struct({ releaseReason: Schema.String, stage: Schema.Literal("released"), workId: Schema.String });
