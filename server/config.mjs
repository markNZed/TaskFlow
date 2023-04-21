import * as dotenv from 'dotenv'
dotenv.config()

const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
const DEFAULT_USER = 'test@testing.com'
const DUMMY_OPENAI = false

const CACHE_ENABLE = process.env.CACHE_ENABLE === 'true' || false;
console.log("CACHE_ENABLE " + CACHE_ENABLE)

export { CLIENT_URL, DEFAULT_USER, DUMMY_OPENAI, CACHE_ENABLE }