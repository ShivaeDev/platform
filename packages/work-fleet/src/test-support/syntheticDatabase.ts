// Stories that resolve a host without opening storage still need a database setting; this one cannot reach a server.
export const syntheticDatabase = { url: "postgresql://synthetic.invalid/work_fleet" };
