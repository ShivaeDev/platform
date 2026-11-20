export const everyRow = Symbol("sql/allRows");

// A delete filter whose entries are all undefined would match the whole table, so deleting every row is spelled out.
export const allRows = { [everyRow]: true } as const;

export type AllRows = typeof allRows;
