const businessConfig = Object.freeze({
  name: 'InfoCore Informática',
  shortName: 'InfoCore',
  legalName: 'InfoCore Informática',
  description: 'Assistência técnica, manutenção, upgrades e soluções em informática em Simão Dias, Sergipe.',
  phoneDisplay: '(79) 99134-3921',
  phoneE164: '+5579991343921',
  whatsappNumber: '5579991343921',
  email: 'contato@infocoretech.com.br',
  address: {
    street: 'Praça Abel Jacó dos Santos, 889',
    neighborhood: 'Centro',
    city: 'Simão Dias',
    region: 'SE',
    postalCode: '49480-000',
    country: 'BR',
  },
  // Os horários encontrados no site antigo eram divergentes. Confirme antes de preencher.
  hours: null,
  instagramHandle: '@infocore_tech',
  instagramUrl: 'https://www.instagram.com/infocore_tech/',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=InfoCore%20Inform%C3%A1tica%20Sim%C3%A3o%20Dias%20SE',
  // Gerado no Google Maps em Compartilhar > Incorporar um mapa. Não exige credenciais.
  googleMapsEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.916762763449!2d-37.813852100000005!3d-10.7408985!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x70fd7ecc7be7301%3A0xdd57bbbdb8a2384d!2sInfoCore%20%7C%20Assist%C3%AAncia%20t%C3%A9cnica%20de%20Computadores%20e%20Notebooks!5e0!3m2!1spt-BR!2sbr!4v1789482284191!5m2!1spt-BR!2sbr',
  // Identificador público do perfil, usado somente pelo sincronizador gratuito e em cache.
  googleMapsCid: '15949423028876752973',
  googleReviewsPageUrl: 'https://www.google.com/maps/place/InfoCore/data=!4m8!3m7!1s0x70fd7ecc7be7301:0xdd57bbbdb8a2384d!8m2!3d-10.7408985!4d-37.8138521!9m1!1b1!16s%2Fg%2F11zb5ld8d6?hl=pt-BR',
  googleReviewSnapshot: Object.freeze({
    score: '5,0',
    count: 19,
    checkedAt: 'setembro de 2026',
    reviews: Object.freeze([
      Object.freeze({ name: 'Vittor', text: 'Muito bom comprei o USB C para USB A e Gostei muito além do antendimento bem o produto testado e aprovado 🤝😊' }),
      Object.freeze({ name: 'Lucas Gabriel', text: 'Muito bom, o problema do meu computador sem gastar quase nada.' }),
      Object.freeze({ name: 'Leonardo Silva', text: 'Loja muito boa. Com peças de qualidade e atendimento profissional.' }),
    ]),
  }),
  googleReviewsUrl: process.env.GOOGLE_REVIEWS_URL || '',
  googleReviewWriteUrl: process.env.GOOGLE_REVIEW_WRITE_URL || '',
});

module.exports = businessConfig;
