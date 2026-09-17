export type WorkerStatus = 'unsupported' | 'registered' | 'conflict' | 'failed' | 'reset';
/** Never take over a different root-scope registration, including waiting/installing workers. */
export declare function registrationIsOwned(registration: Pick<ServiceWorkerRegistration, 'active' | 'waiting' | 'installing'>, origin: string): boolean;
export declare function registerOwnWorker(container: ServiceWorkerContainer | undefined, origin: string, secure: boolean, manifestHrefs?: readonly string[]): Promise<WorkerStatus>;
/** Explicit reset only unregisters our own script; never clears any origin caches. */
export declare function unregisterOwnWorkers(container: ServiceWorkerContainer | undefined, origin: string): Promise<number>;
