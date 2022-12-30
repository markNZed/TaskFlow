import express from 'express'
import * as dotenv from 'dotenv'
import cors from 'cors'
import { Configuration, OpenAIApi } from 'openai'

dotenv.config()

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

const app = express()
app.use(cors())
app.use(express.json())

app.get('/', async (req, res) => {
  res.status(200).send({
    message: 'Hello world!'
  })
})

app.post('/', async (req, res) => {
  try {
    const {prompt, langModel, temperature, maxTokens, impersonation} = req.body;
    console.log(impersonation);
    const msg = impersonation?
                `pretend you are ${impersonation}, ${prompt}`:
                prompt;
    console.log(msg);

    const response = await openai.createCompletion({
      model: `${langModel}`,
      prompt: `${msg}`,
      temperature: temperature, // Higher values means the model will generate more variations.
      max_tokens: maxTokens, // The maximum number of tokens to generate in the completion. Most models have a context length of 2048 tokens (except for the newest models, which support 4096).
      top_p: 1, // alternative to sampling with temperature, called nucleus sampling
      frequency_penalty: 0.5, // Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim.
      presence_penalty: 0, // Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics.
    });

    console.log(response.data)

    res.status(200).send({
      bot: response.data.choices[0].text
    });

  } catch (error) {
    console.error(error)
    res.status(500).send(error || 'Something went wrong');
  }
})

app.get('/models', async (req, res) => {
  try {
    const prompt = req.body.prompt;

    const response = await await openai.listEngines();

    res.status(200).send({
      models: response.data.data,
    });

  } catch (error) {
    console.error(error)
    res.status(500).send(error || 'Something went wrong');
  }
})

const port = process.env.port || 5000;
app.listen(port, () => console.log('AI server already started at the back-end'))