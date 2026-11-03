import { Schema } from "effect";

export const PublishedPackage = Schema.Struct({ name: Schema.String, version: Schema.String });
export type PublishedPackage = typeof PublishedPackage.Type;
export const PublishedPackages = Schema.Struct({ publishedPackages: Schema.Array(PublishedPackage) });
