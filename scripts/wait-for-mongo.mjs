import net from 'node:net';
import { execSync } from 'node:child_process';

const PORTS = [27017, 27018];
const MAX_ATTEMPTS = 30;
const DELAY_MS = 1000;

function checkPort(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPorts() {
  console.log('Waiting for MongoDB instances to be ready on ports 27017 and 27018...');
  for (const port of PORTS) {
    let ready = false;
    for (let i = 1; i <= MAX_ATTEMPTS; i++) {
      ready = await checkPort(port);
      if (ready) {
        console.log(`Port ${port} is reachable.`);
        break;
      }
      await sleep(DELAY_MS);
    }
    if (!ready) {
      console.warn(`Warning: Port ${port} was not reachable within ${MAX_ATTEMPTS} seconds.`);
    }
  }

  // Attempt to ensure replica set initiation via docker exec if available
  try {
    console.log('Checking replica set status for sms-mongo...');
    execSync('docker exec sms-mongo mongosh --port 27017 --quiet --eval "try { rs.status().ok } catch(e) { rs.initiate({ _id: \\"rs0\\", members: [{ _id: 0, host: \\"localhost:27017\\" }] }) }"', { stdio: 'ignore' });
    console.log('sms-mongo replica set rs0 is verified.');
  } catch (err) {
    // If docker is not running or container has another name, healthcheck in docker-compose handles it
  }

  try {
    console.log('Checking replica set status for sms-mongo-test...');
    execSync('docker exec sms-mongo-test mongosh --port 27018 --quiet --eval "try { rs.status().ok } catch(e) { rs.initiate({ _id: \\"rs0\\", members: [{ _id: 0, host: \\"localhost:27018\\" }] }) }"', { stdio: 'ignore' });
    console.log('sms-mongo-test replica set rs0 is verified.');
  } catch (err) {
    // Healthcheck in docker-compose handles it
  }

  console.log('MongoDB initialization check completed.');
}

waitForPorts();

