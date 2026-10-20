import { create } from 'zustand';

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

interface ConfirmState {
  options: ConfirmOptions | null;
  resolve: ((result: boolean) => void) | null;
  /** Ask the user to confirm; resolves true when they confirm. */
  request: (options: ConfirmOptions) => Promise<boolean>;
  /** Resolve the open dialog with the given answer. */
  answer: (result: boolean) => void;
}

/**
 * A promise-based confirmation dialog.
 *
 * `window.confirm` blocks the main thread, ignores the theme and cannot be
 * styled or tested; this replaces it with the app's Radix dialog while
 * keeping the call sites as simple as the native one.
 */
export const useConfirmStore = create<ConfirmState>()((set, get) => ({
  options: null,
  resolve: null,

  request: (options: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      // A second request supersedes the first one rather than queueing.
      get().resolve?.(false);
      set({ options, resolve });
    }),

  answer: (result: boolean) => {
    const { resolve } = get();
    set({ options: null, resolve: null });
    resolve?.(result);
  },
}));

/** Ask the user to confirm an action; resolves `true` when they agree. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().request(options);
}
