import { MongoClient, ServerApiVersion } from "mongodb";

const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 60000,
  family: 4,
  retryWrites: true,
  retryReads: true,
};

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// Lazily creates (or reuses) the MongoClient connection.
// Stored on `global` so Next.js HMR re-imports don't open extra connections.
function connect(): Promise<MongoClient> {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not defined in environment variables.");
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri, options).connect();
  }
  return global._mongoClientPromise;
}

// `connect()` is intentionally deferred until this promise is actually awaited.
// Calling it eagerly at module-load time would fail during Next.js static
// generation when MONGO_URI may not yet be injected into the environment.
const clientPromise: Promise<MongoClient> = Promise.resolve().then(() => connect());

export default clientPromise;
