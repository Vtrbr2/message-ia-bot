class GeminiService {
  async generateResponse(userMessage, contactName = 'Cliente') {
    try {
      // Simulação da API do Gemini (substituir pela real)
      const responses = {
        'oi': `Olá ${contactName}! 😊 Como posso ajudar você hoje?`,
        'ola': `Olá ${contactName}! 😊 Em que posso ser útil?`,
        'obrigado': `De nada ${contactName}! Fico feliz em ajudar! 🚀`,
        'obrigada': `Por nada ${contactName}! Estou aqui para o que precisar! 💫`,
        'default': `Olá ${contactName}! Sou seu assistente virtual. Posso ajudar com:\n\n` +
                  `🛒 Orçamento de templates\n` +
                  `📅 Agendamento de atendimento\n` +
                  `💬 Dúvidas sobre serviços\n\n` +
                  `Digite "orçamento" para começarmos!`
      };

      const lowerMessage = userMessage.toLowerCase();
      
      if (lowerMessage.includes('orçamento') || lowerMessage.includes('orcamento')) {
        return `Perfeito ${contactName}! Vamos criar um orçamento personalizado para você. 🚀\n\n` +
               `Por favor, me diga:\n` +
               `1. Qual tipo de projeto você precisa?\n` +
               `2. Tem algum prazo específico?\n` +
               `3. Orçamento aproximado?`;
      }

      return responses[lowerMessage] || responses['default'];
      
    } catch (error) {
      console.error('❌ Erro Gemini AI:', error);
      return `Olá ${contactName}! No momento estou com limitações técnicas. Por favor, use os comandos:\n\n"orçamento" - Para solicitar orçamento\n"atendimento" - Para agendar horário`;
    }
  }
}

export default new GeminiService();
