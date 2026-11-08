export const scenarios = {
  all: { label: 'All maritime tests', pattern: null },
  offline: { label: 'Offline booking recovery', pattern: 'recovers an offline booking over satellite latency without duplication$' },
  provider: { label: 'Provider API mock', pattern: 'fulfills the volatile booking-provider boundary deterministically$' },
  date: { label: 'Port-local date', pattern: 'renders the fixed UTC instant in the local port timezone$' },
  timezone: { label: 'Browser timezone override', pattern: 'fixture overrides the browser timezone independently of the host$' },
};
export function testArguments(id = 'all') {
  if (!Object.hasOwn(scenarios, id)) throw new Error('Unknown test selection');
  const pattern = scenarios[id].pattern;
  return pattern ? ['--', '--grep', pattern] : [];
}
