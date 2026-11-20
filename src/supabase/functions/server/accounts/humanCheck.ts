import { AccountFault } from "./accountRepository.ts";

export interface HumanCheck {
  verifyClaim(turnstileToken: string | undefined): Promise<void>;
}

// 22C.3 replaces this with verified Turnstile + atomic replay protection.
// Missing configuration/protection must never silently admit claims.
export const closedHumanCheck: HumanCheck = {
  verifyClaim() {
    return Promise.reject(new AccountFault("CAPTCHA_UNAVAILABLE"));
  },
};
