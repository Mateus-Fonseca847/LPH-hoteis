# Lighthouse Audit

## Meta

- Performance: >= 90
- Accessibility: >= 90
- Best Practices: >= 90
- SEO: >= 90

## Otimizacoes aplicadas

- `next/image` configurado para AVIF/WebP, tamanhos responsivos e cache minimo de 30 dias.
- Imagem principal do hero mantida com `priority`, `sizes="100vw"` e qualidade controlada para LCP.
- Imagens reutilizaveis com fallback agora usam lazy loading por padrao e `decoding="async"`.
- Fontes via `next/font` com `display: "swap"`, preload e fallback ajustado para reduzir CLS.
- Metadata global reforcada com viewport, robots, Open Graph, Twitter Card e manifest.
- Lista publica de hoteis cacheada por 5 minutos para reduzir TTFB sem afetar reservas.
- Sitemap com cache habilitado e revalidacao efetiva alinhada aos dados publicos.
- Headers de seguranca adicionados para melhorar Best Practices.
- Cache imutavel configurado para assets em `/uploads` e `/images`.

## Pontos preservados

- Regras de negocio nao foram alteradas.
- Home segue dinamica por depender do estado de login no header, mas os dados publicos pesados estao cacheados.
- Paginas com fluxo sensivel de reserva/checkout permanecem dinamicas quando dependem de estado transacional.
- Nenhum schema foi alterado.

## Validacao recomendada

Executar contra build de producao:

```bash
npm run build
npm run start
```

Depois medir a URL publica ou local em modo producao com Lighthouse:

```bash
lighthouse http://localhost:3000 --view
```

## Checklist Lighthouse

- LCP: hero usa imagem prioritaria e dimensao estavel.
- CLS: fontes possuem fallback ajustado e containers de imagem preservam area.
- Imagens: formatos modernos e lazy loading em imagens nao prioritarias.
- Cache: paginas publicas e assets estaticos possuem politica explicita.
- SEO: metadata, canonical, sitemap, manifest e robots configurados.
- Best Practices: headers basicos de seguranca ativos.

## Resultado

Projeto preparado para auditoria Lighthouse de producao com alvo minimo de 90 em Performance, Accessibility, Best Practices e SEO.
As pontuacoes finais devem ser confirmadas no ambiente publicado, pois dependem de CDN, latencia, compressao e imagens remotas.
