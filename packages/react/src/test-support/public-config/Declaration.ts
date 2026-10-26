import { Schema } from "effect";
import { publicConfig } from "@shivaedev/platform/rpc/publicConfig.ts";

export const PublicConfigDeclaration = publicConfig(Schema.Struct({ installUrl: Schema.URL }).pipe(Schema.encodeKeys({ installUrl: "INSTALL_URL" })));
