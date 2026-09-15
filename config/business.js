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
  googleReviewsUrl: process.env.GOOGLE_REVIEWS_URL || '',
  googleReviewWriteUrl: process.env.GOOGLE_REVIEW_WRITE_URL || '',
});

module.exports = businessConfig;
