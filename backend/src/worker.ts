import { startWorker } from './jobs/sweeps.js';

// ponytail: with the in-memory store this process sees no API data; useful once the DB replaces common/store.ts.
startWorker();
setInterval(() => {}, 1 << 30); // keep the process alive
