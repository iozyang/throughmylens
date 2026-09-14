export const maximumResistance = 10;
export type ResistanceState = { position: number; velocity: number };

export function resistanceTarget(input: number) {
  return maximumResistance * (1 - Math.exp(-Math.max(0, input) / 180));
}

// Exact critically damped spring step; no decorative oscillation or linear pull.
export function stepResistance(state: ResistanceState, target: number, seconds: number): ResistanceState {
  const dt = Math.max(0, Math.min(seconds, 1 / 30)), frequency = 18;
  const offset = state.position - target;
  const impulse = state.velocity + frequency * offset;
  const decay = Math.exp(-frequency * dt);
  return {
    position: Math.max(0, Math.min(maximumResistance, target + (offset + impulse * dt) * decay)),
    velocity: (state.velocity - frequency * impulse * dt) * decay,
  };
}

export function atPageEnd(scrollTop: number, scrollHeight: number, clientHeight: number) {
  const end = scrollHeight - clientHeight;
  // Ignore native rubber-band positions outside the actual scroll range.
  return end > 0 && scrollTop >= end - 1 && scrollTop <= end + 1;
}
