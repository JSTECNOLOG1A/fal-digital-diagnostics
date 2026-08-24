const NativeDate = Date;

export function createDeterministicRuntime({ now, clockSequence = [], uuidSequence = [], nativeRandomUUID = null } = {}) {
  const times = clockSequence.length ? [...clockSequence] : now ? [now] : [];
  const uuids = [...uuidSequence];
  const clockCalls = [];
  const uuidCalls = [];
  const nextTime = () => {
    const value = times[Math.min(clockCalls.length, Math.max(times.length - 1, 0))] || new NativeDate().toISOString();
    clockCalls.push(value);
    return value;
  };
  return {
    now: () => new NativeDate(nextTime()),
    randomUUID: () => {
      if (!uuids.length && !nativeRandomUUID) throw new Error('DETERMINISTIC_UUID_EXHAUSTED');
      const value = uuids.length ? uuids.shift() : nativeRandomUUID();
      uuidCalls.push(value);
      return value;
    },
    clockCalls,
    uuidCalls,
  };
}