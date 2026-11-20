import { AccountFault } from "./accountRepository.ts";

export class HashAdmission {
  #active = 0;
  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.#active >= 4) throw new AccountFault("AUTH_BUSY");
    this.#active++;
    try {
      return await work();
    } finally {
      this.#active--;
    }
  }
}

export const workerHashAdmission = new HashAdmission();
