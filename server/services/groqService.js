const OpenAI = require("openai");

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

async function askGroq(prompt) {
  const completion =
    await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",

      messages: [
        {
          role: "system",
          content:
            "You are Sarathi Temple Guide. Give accurate travel and temple information."
        },
        {
          role: "user",
          content: prompt
        }
      ],

      temperature: 0.3,
      max_tokens: 1000
    });

  return completion.choices[0].message.content;
}

module.exports = askGroq;