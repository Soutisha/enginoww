/**
 * Jest executes these specs with Jest's runtime globals. Keep the minimal
 * ambient declarations in the API project so ts-jest can type-check tests
 * without relying on implicit global packages.
 */
declare const describe: (name: string, suite: () => void) => void;
declare const it: (name: string, test: () => void | Promise<void>) => void;
declare const test: (name: string, body: () => void | Promise<void>) => void;
declare const expect: (actual: any) => any;
