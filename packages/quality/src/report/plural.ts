export const plural = (count: number, singular: string, many = `${singular}s`): string => `${count} ${count === 1 ? singular : many}`;
