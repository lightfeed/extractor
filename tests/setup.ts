import { config } from "dotenv";
import * as path from "path";

// Load environment variables from .env file
config({ path: path.resolve(process.cwd(), ".env") });

// Set default timeout for tests (useful for tests involving LLM API calls)
jest.setTimeout(30000);
