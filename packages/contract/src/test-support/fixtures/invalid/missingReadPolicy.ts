import { Effect } from "effect";
import { contract } from "#contract.ts";
import { query } from "#operation.ts";
import { signedIn } from "#readPolicy.ts";

const Read = query("read", { live: "rerun-and-compare", readPolicy: signedIn, reads: () => [] });
const { readPolicy, ...unprotected } = Read;
void readPolicy;
contract("unprotected", { queries: [unprotected] }).application.toLayer({ "unprotected.read": () => Effect.void });
