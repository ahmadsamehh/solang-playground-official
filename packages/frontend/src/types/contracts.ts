export interface ICompiled {
    path: string,
    name: string,
    compiledAt: number,
}

export interface ICurrentWasm {
    path: string,
    buff: Buffer | null,
}

export type TxKind = "deploy" | "invoke";

export interface TxRecord {
    id: string,
    kind: TxKind,
    status: "success" | "failed",
    /** On-chain transaction hash; absent when no transaction was submitted. */
    hash?: string,
    contractId?: string,
    /** Contract file name (deploy) or method name (invoke). */
    label: string,
    returnValue?: string,
    logs?: string[],
    error?: string,
    timestamp: number,
}
