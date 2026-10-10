import { Layer } from "effect";
import { makePlatformRuntime } from "#runtime/make.ts";

const DEVELOPMENT_CACHE_KEY = "production-runtime-test";
const first = makePlatformRuntime(Layer.empty, { developmentCacheKey: DEVELOPMENT_CACHE_KEY });
const second = makePlatformRuntime(Layer.empty, { developmentCacheKey: DEVELOPMENT_CACHE_KEY });
process.stdout.write(first === second ? "shared" : "distinct");
await first.dispose();
await second.dispose();
