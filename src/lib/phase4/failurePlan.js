export function createFailureController(failurePlan = {}) {
  const calls = {};
  const failures = [];
  const check = (key, phase, state) => {
    const callKey = `${key}:${phase}`;
    const callNumber = (calls[callKey] || 0) + 1;
    calls[callKey] = callNumber;
    const configured = failurePlan[key];
    const rule = configured?.[phase] || (phase === 'before' && configured?.atCall ? configured : null);
    if (rule && callNumber === rule.atCall) {
      const failure = { key, phase, callNumber, message: rule.message, state: structuredClone(state) };
      failures.push(failure);
      throw new Error(rule.message);
    }
    return callNumber;
  };
  return { check, calls, failures };
}