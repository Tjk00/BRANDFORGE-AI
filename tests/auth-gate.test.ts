import { describe, expect, it } from 'vitest';
import { authGateVisible } from '../src/lib/auth-gate';

describe('auth gate (post sign-out blank screen regression)', () => {
  it('shows the sign-in screen after an explicit sign-out', () => {
    // Sign out clears the session and raises showAuth: the gate must take over,
    // otherwise the shell renders every stage with no user and no content.
    expect(authGateVisible({ showAuth: true, signedIn: false, serverAvailable: true })).toBe(true);
  });

  it('never replaces the studio while a session is active', () => {
    expect(authGateVisible({ showAuth: true, signedIn: true, serverAvailable: true })).toBe(false);
  });

  it('stays out of the way until the user asks for sign-in', () => {
    expect(authGateVisible({ showAuth: false, signedIn: false, serverAvailable: true })).toBe(false);
  });

  it('keeps local mode usable when the account server is unreachable', () => {
    // Offline or API-less deployments must still reach the studio.
    expect(authGateVisible({ showAuth: true, signedIn: false, serverAvailable: false })).toBe(false);
  });
});
