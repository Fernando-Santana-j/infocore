# Conteúdo visual da InfoCore

## Adicionar fotos aos serviços

1. Crie a pasta `public/img/services/`.
2. Salve fotos reais, autorizadas e otimizadas em WebP ou AVIF. Use aproximadamente 1200 × 900 px e, de preferência, menos de 200 KB.
3. Abra `config/service-showcase.js`.
4. Preencha o campo `image` do serviço desejado.

Exemplo:

```js
{
  slug: 'troca_tela',
  title: 'Troca de tela',
  image: '/public/img/services/troca-tela.webp',
  alt: 'Troca de tela de notebook realizada pela InfoCore'
}
```

Quando `image` fica vazio, o site usa uma ilustração técnica. Isso evita imagens quebradas e permite publicar a seção antes de completar o acervo.

Não use fotografia de banco como se fosse serviço realizado. O `alt` deve descrever o que realmente aparece e não deve incluir palavras-chave sem relação com a imagem.

## Check-up digital

O navegador pode fornecer somente informações aproximadas, como tipo de dispositivo, quantidade lógica de processadores e, em alguns navegadores, uma estimativa de memória. Ele não pode diagnosticar placa, SSD, temperatura, integridade do disco ou modelo exato de hardware.

Por isso, o check-up combina:

- detecção básica autorizada pelo navegador;
- leitura básica automática pelo navegador;
- um script PowerShell opcional que coleta somente CPU, RAM, discos, GPU e versão do Windows;
- sessão aleatória em memória, sem banco de dados, com validade de 10 minutos;
- recomendação de orientação, nunca um diagnóstico técnico definitivo;
- mensagem de WhatsApp personalizada com o resumo, sem enviar especificações completas para GA4 ou Meta.

Um site não pode abrir o PowerShell sem autorização. O visitante baixa um iniciador `.cmd` e o abre com duplo clique; o código completo também pode ser visualizado no popup da própria página antes da execução. O script não lê arquivos, senhas, números de série, nome do usuário, MAC ou outros identificadores.

Os textos e regras ficam na função `setDiagnostic()` em `public/js/script.js`.
