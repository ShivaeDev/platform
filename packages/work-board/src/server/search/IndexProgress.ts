import { Context, type SubscriptionRef } from "effect";
import type { Indexing } from "#rpc/Indexing.ts";

export class IndexProgress extends Context.Service<IndexProgress, SubscriptionRef.SubscriptionRef<Indexing | undefined>>()(
	"WorkBoard/IndexProgress",
) {}
