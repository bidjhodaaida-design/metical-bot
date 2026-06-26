require('dotenv').config();
const express = require('express');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function sendWhatsApp(phone, message) {
  await axios.post(
    `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}/send-text`,
    { phone, message }
  );
}

app.post('/webhook', async (req, res) => {
  const { phone, text } = req.body;
  if (!text || !phone) return res.sendStatus(200);

  let { data: user } = await supabase
    .from('users').select('*').eq('phone', phone).single();

  if (!user) {
    await supabase.from('users').insert({ phone });
    ({ data: user } = await supabase
      .from('users').select('*').eq('phone', phone).single());
  }

  const { data: txns } = await supabase
    .from('transactions').select('*')
    .eq('user_id', user.id).limit(10);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `És o Meu Metical AI, assistente financeiro para moçambicanos.
Respondes sempre em Português (pt-MZ). Moeda: MZN.
Histórico de transações: ${JSON.stringify(txns)}.
És amigável, encorajador e nunca julgas. Máximo 250 palavras. 💚`
      },
      { role: 'user', content: text }
    ],
    max_tokens: 300
  });

  const reply = completion.choices[0].message.content;
  await sendWhatsApp(phone, reply);
  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () =>
  console.log('✅ Meu Metical AI rodando!'));
