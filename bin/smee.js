const SmeeClient = require('smee-client');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const main = () => {
  const smee = new SmeeClient({
    source: process.env.SMEE_URL,
    target: `http://localhost:${process.env.PORT}/events`,
    logger: console
  });

  const events = smee.start();

  process.on('exit', () => events.close());
  process.on('SIGINT', () => events.close());
  process.on('SIGUSR1', () => events.close());
  process.on('SIGUSR2', () => events.close());
  process.on('uncaughtException', () => events.close());
};

main();