// Serviço de PIX - Versão simplificada
export class PixService {
  static generatePIX(amount, description, userPhone) {
    return new Promise((resolve) => {
      // Simulação de geração de PIX
      setTimeout(() => {
        const payload = this.generateStaticPIXPayload(amount, description);
        
        resolve({
          success: true,
          payload: payload,
          qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payload)}`,
          instructions: `💎 *PIX COPIA E COLA:*\n${payload}\n\n💵 *Valor:* R$ ${amount}\n📝 *Descrição:* ${description}`,
          merchant: {
            name: 'Vitor',
            city: 'São Paulo',
            key: '16997454758'
          }
        });
      }, 500);
    });
  }

  static generateStaticPIXPayload(amount, description) {
    const amountFormatted = parseFloat(amount).toFixed(2).replace('.', '').padStart(13, '0');
    
    // Payload PIX estático para desenvolvimento
    return `00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-42661417400052040000530398654${amountFormatted}5802BR5913VITOR6008SAO PAULO62140510${description.substring(0, 10)}6304`;
  }
}

export default PixService;
