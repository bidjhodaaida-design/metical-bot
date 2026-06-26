require('dotenv').config();
const express = require('express');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// Função corrigida (linha 17)
const sendWhatsApp = async (phone, message) => {
  await axios.post(`https://api.zapto.xyz/instances/${process.env.ZAP_INSTANCE_ID}/token/${process.env.ZAP_TOKEN}/send-text`, {
    phone, message
  });
};

app.post('/webhook', async (req, res) => {
  const { phone, text } = req.body;
  if (!text || !phone) return res.sendStatus(200);

  // Verifica se o usuário existe
  let { data: user } = await supabase
    .from('users').select('*').eq('phone', phone).single();

  if (!user) {
    await supabase.from('users').insert({ phone });
  }

  // CORREÇÃO DA LINHA 35: Busca as transações com segurança
  let txn = [];
  const { data: transactionsData } = await supabase
    .from('transactions').select('*')
    .eq('user_id', user.id).limit(10);

  if (transactionsData) {
    txn = transactionsData;
  }

  // Chama a inteligência artificial
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `És o Meu Metical AI, assistente financeiro para moçambicanos. 
Responde sempre em Português (pt-BR). Modo: BOT. 
Histórico de transações: ${JSON.stringify(txn)}.
És amigável, encorajador e nunca julgas. Máximo 250 palavras. 🟢`
      },
      {
        role: 'user', content: text
      }
    ],
    max_tokens: 300
  });

  const reply = completion.choices[0].message.content;
  await sendWhatsApp(phone, reply);
  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => {
  console.log('✅ Meu Metical AI rodando!');
});
