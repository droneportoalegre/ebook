# Guia de Diagramação e Publicação

## Arquivo principal
Use este arquivo como base do livro:
- `ebook-legislacao-drones-brasil-pronto-para-venda.md`

## Especificações para versão PDF profissional
- Formato de página: 16 x 23 cm (ou A5, se preferir padrão mais comum).
- Margens: 2 cm (superior, inferior, interna e externa).
- Fonte de texto: Lora 11 pt (ou Garamond 11 pt).
- Fonte de títulos: Montserrat SemiBold.
- Espaçamento entre linhas: 1.35.
- Recuo de parágrafo: 0.6 cm.
- Numeração: iniciar após páginas iniciais.

## Ordem recomendada das páginas
1. Capa.
2. Página de direitos.
3. Dedicatória.
4. Prefácio.
5. Sumário.
6. Capítulos.
7. Apêndices.
8. Referências.
9. Página final com CTA.

## Capa (texto pronto)
Título: DRONE LEGAL BRASIL  
Subtítulo: O Guia Completo da Legislação de Drones no Brasil  
Linha de apoio: Do Zero ao Pró com ANAC, DECEA, ANATEL e Seguro RETA  
Autor: Wesley Santos

## Paleta sugerida (visual premium técnico)
- Azul petróleo: #0D3B66
- Ciano técnico: #00A8E8
- Cinza escuro: #1F2933
- Cinza claro: #E5E7EB
- Branco: #FFFFFF

## Estrutura para versão de venda digital
- Produto principal: eBook PDF.
- Bônus 1: checklist mestre de missão (extraído do capítulo 13).
- Bônus 2: plano 30/60/90 dias (capítulo 12).
- CTA final: consultoria, mentoria ou pacote de implantação.

## Conversão simples para PDF (exemplo com Pandoc)
Se você tiver Pandoc instalado:

```bash
pandoc ebook-legislacao-drones-brasil-pronto-para-venda.md \
  -o ebook-legislacao-drones-brasil.pdf \
  --from markdown --toc --number-sections
```

## Controle de qualidade antes de publicar
- Revisar ortografia e consistência de termos (RETA, não Rota).
- Validar todos os links oficiais.
- Conferir se data de referência regulatória está mantida.
- Revisar identidade visual da capa e da página de vendas.

