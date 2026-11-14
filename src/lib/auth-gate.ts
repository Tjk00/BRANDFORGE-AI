/**
 * The single rule that decides whether the full-screen sign-in gate replaces
 * the studio shell.
 *
 * Blank-screen regression context: the shell used to stay mounted after an
 * explicit sign-out, leaving a signed-out user with an empty content area and
 * no way back in. The decision lives here, as a pure function, so the rule is
 * covered by a test that needs no DOM.
 */
export interface AuthGateState {
  /** The user asked for the sign-in screen (Sign out, Account → Sign in, …). */
  showAuth: boolean;
  /** A real signed-in session exists. */
  signedIn: boolean;
  /** The account server answered, so signing in is actually possible. */
  serverAvailable: boolean;
}

export function authGateVisible(state: AuthGateState): boolean {
  return state.showAuth && !state.signedIn && state.serverAvailable;
}
