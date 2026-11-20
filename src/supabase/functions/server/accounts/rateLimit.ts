export type AccountCategory =
  | "claim"
  | "sign-in"
  | "password"
  | "resume"
  | "logout";
export interface AccountAdmissionContext {
  category: AccountCategory;
  // Gateway/session/account credentials are removed; never log this context.
  headers: Headers;
  turnstileToken?: string;
}

// 22C.3: implement these hooks using persisted counters, trusted ingress and
// escalation. No raw account token/password is passed to this interface.
export interface AccountRateLimit {
  entry(context: AccountAdmissionContext): Promise<void>;
  target(context: AccountAdmissionContext, nameKey: string): Promise<void>;
  beforeHash(context: AccountAdmissionContext, nameKey: string): Promise<void>;
  verification(
    context: AccountAdmissionContext,
    nameKey: string,
    success: boolean,
  ): Promise<void>;
  token(
    context: AccountAdmissionContext,
    tokenHash?: Uint8Array,
  ): Promise<void>;
}
export const allowAccountRateLimit: AccountRateLimit = {
  entry: () => Promise.resolve(),
  target: () => Promise.resolve(),
  beforeHash: () => Promise.resolve(),
  verification: () => Promise.resolve(),
  token: () => Promise.resolve(),
};
