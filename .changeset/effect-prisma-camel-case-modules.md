---
"@shivaedev/effect-prisma": minor
---

### Breaking

- Modules are named in camelCase or after their export: `relation/include-metadata.ts` becomes `relation/includeMetadata.ts`, and `relation/prisma-methods.ts` becomes `relation/PrismaMethods.ts`, whose `PrismaRelationMethods` type is renamed `RelationPrismaMethods`.
