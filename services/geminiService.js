import axios from 'axios';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

export async function generateResponse(userMessage, contactName = 'Cliente') {
  try {
    const prompt = `Você é um assistente de vendas especializado em desenvolvimento de sites e templates. 
    Responda de forma amigável, profissional e útil ao cliente.
    
    Contexto:
    - Cliente: ${contactName}
    - Mensagem: "${userMessage}"
    - Seu papel: Assistente de vendas para desenvolvimento web
    
    Regras:
    - Responda em português brasileiro
    - Seja natural e conversacional
    - Mantenha respostas curtas (máximo 3 linhas)
    - Se for cumprimento, responda educadamente
    - Se for sobre orçamentos, direcione para o fluxo de orçamento
    - Se for sobre templates, mostre entusiasmo
    - Use emojis moderadamente
    
    Mensagem do cliente: "${userMessage}"`;

    const response = await axios.post(GEMINI_URL, {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return response.data.candidates[0].content.parts[0].text;
    
  } catch (error) {
    console.error('❌ Erro Gemini AI:', error.response?.data || error.message);
    
    // Fallback responses
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('ola') || lowerMessage.includes('olá') || lowerMessage === 'oi') {
      return `Olá ${contactName}! 😊 Em que posso ajudar você hoje?`;
    }
    
    if (lowerMessage.includes('orçamento') || lowerMessage.includes('orcamento')) {
      return `Perfeito ${contactName}! Vamos criar um orçamento personalizado. 🚀\n\nDigite "orçamento" para ver nossas opções!`;
    }
    
    if (lowerMessage.includes('obrigado') || lowerMessage.includes('obrigada')) {
      return `Por nada, ${contactName}! Fico feliz em ajudar! 💫`;
    }
    
    return `Olá ${contactName}! Sou seu assistente virtual. Posso ajudar com:\n\n🎨 Orçamentos de sites\n📅 Agendamentos\n💬 Dúvidas técnicas\n\nDigite "orçamento" para começarmos!`;
  }
}
