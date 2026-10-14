import { createApp } from './app.js';
import { seedDevUsers } from './common/auth.js';
import { logger } from './common/logger.js';
import { config } from './config.js';
import { startWorker } from './jobs/sweeps.js';

await seedDevUsers();
if (config.workerInline) startWorker();
createApp().listen(config.port, () => logger.info(`API listening on :${config.port}`));
