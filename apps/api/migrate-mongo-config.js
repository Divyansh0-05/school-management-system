import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const uri =
  process.env.NODE_ENV === 'test'
    ? process.env.MONGODB_TEST_URI || 'mongodb://localhost:27018/school_management_test?replicaSet=rs0'
    : process.env.MONGODB_URI || 'mongodb://localhost:27017/school_management?replicaSet=rs0';

const dbNameMatch = uri.match(/\/([^/?]+)(\?|$)/);
const databaseName = dbNameMatch ? dbNameMatch[1] : 'school_management';

const config = {
  mongodb: {
    url: uri,
    databaseName,
  },
  migrationsDir: path.resolve(__dirname, 'migrations'),
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'esm',
};

export default config;
