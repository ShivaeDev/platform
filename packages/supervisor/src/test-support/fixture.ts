export const fixture = `
process.on('SIGTERM', () => {
  if (process.stdout.writableEnded) process.exit(0);
  if (process.env.STUBBORN !== 'yes') process.stdout.write('stopping\\n', () => process.exit(0));
});
process.on('SIGQUIT', () => process.stdout.end());
process.on('SIGINT', () => process.exit(7));
process.on('SIGUSR2', () => process.stdout.write('invalid readiness\\n'));
process.on('SIGUSR1', () => {
  process.stdout.write(JSON.stringify({ pid: process.pid, dependency: process.env.DEPENDENCY || null }) + '\\n');
  process.stdout.write('serving requests\\n'.repeat(Number(process.env.LOG_LINES || '1')));
});
process.stderr.write('started:' + process.pid + '\\n');
setInterval(() => {}, 1000);
`;
