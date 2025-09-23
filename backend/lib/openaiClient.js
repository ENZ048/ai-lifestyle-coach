const OpenAI = require('openai');

if (!process.env.OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = openai;
