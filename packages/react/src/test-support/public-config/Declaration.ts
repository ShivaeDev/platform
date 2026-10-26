import { Schema } from "effect";
import { publicConfig } from "@shivaedev/contract/publicConfig.ts";

export const PublicConfigDeclaration = publicConfig(Schema.Struct({ installUrl: Schema.URL }).pipe(Schema.encodeKeys({ installUrl: "INSTALL_URL" })));
