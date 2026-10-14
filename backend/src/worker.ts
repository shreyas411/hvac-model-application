import { startWorker } from './jobs/sweeps.js';

startWorker();
setInterval(() => {}, 1 << 30); // keep the process alive
