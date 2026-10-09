import { useEffect, useState } from "react";

/**
 * True once the page has finished loading its scripts and React has taken over.
 *
 * The server sends the form as plain HTML first. Until React attaches, a click
 * on the submit button is handled by the browser itself, which just reloads the
 * page instead of running the app's sign-in code. Buttons stay disabled until
 * this returns true so nobody can click too early.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
