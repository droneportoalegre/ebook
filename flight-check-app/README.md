# DroneOps Check App

Aplicativo web para checklist operacional de voo com:
- navegacao SPA por abas: Checklist, Historico e Loja,
- checklist por fases (pre-voo, documentacao, SARPAS, RETA, pos-voo),
- decisao automatica GO/NO-GO,
- consulta de clima (Open-Meteo),
- conector para interface UAV Forecast,
- registro operacional (piloto responsavel, cliente, log e incidentes),
- historico com filtros (busca, status e incidente),
- loja com catalogo, carrinho e finalizacao por WhatsApp,
- ordenacao de catalogo por nome/preco e botao de copiar pedido,
- alertas de vencimento documental (SISANT, SARPAS, ANATEL, RETA),
- trilha auditavel com exportacao JSON (data, usuario, acao, detalhe),
- historico de voos,
- exportacao JSON e CSV.

## Como editar itens da Loja
1. Abra `data/store-items.js`.
2. Edite o array `window.STORE_ITEMS`.
3. Cada item aceita:
   - `id` (unico),
   - `nome`,
   - `categoria` (Baterias, Helices, Seguro RETA, Drone, Drone usado, Servicos),
   - `preco` (numero) **ou** `sobConsulta: true`,
   - `descricao` (curta).
4. Salve o arquivo e recarregue a pagina.

## Deploy rapido (Fase 1)
### Vercel (recomendado)
1. Suba a pasta `flight-check-app` para um repositorio GitHub.
2. No Vercel, clique em `New Project` e importe o repositorio.
3. Em `Root Directory`, selecione `flight-check-app` (se nao estiver na raiz).
4. Clique em `Deploy`.

### Netlify
1. Conecte o repositorio no Netlify.
2. Configure `Base directory` como `flight-check-app` (se necessario).
3. `Publish directory`: `.` (ponto).
4. Clique em `Deploy site`.

## Como usar
1. Abra `index.html` no navegador.
2. Preencha dados da missao.
3. Marque o checklist pre-voo.
4. Clique em `Atualizar clima` para carregar vento/rajada.
5. Clique em `Abrir UAV Forecast` para abrir a interface.
6. Opcional: cole payload JSON no bloco `Conector UAV Forecast` e clique `Sincronizar payload`.
7. Verifique o status GO/NO-GO.
8. Salve e exporte o historico quando necessario.

## Compliance documental (vencimentos)
- Preencha as datas de validade em `Compliance documental` na aba `Checklist`.
- O app sinaliza:
  - `OK`: validade acima de 30 dias,
  - `Atencao`: vence em ate 30 dias,
  - `Critico`: vence em ate 7 dias,
  - `Vencido`: data expirada.
- Se houver documento vencido, o status operacional entra em `NO-GO`.

## Regras automáticas por operação (Versao 3)
As validacoes abaixo rodam automaticamente no status de voo:
- `SISANT` obrigatorio para drone acima de `250g`.
- `ANATEL` obrigatorio para operacao `nao recreativa`.
- `RETA` obrigatorio para operacao `nao recreativa` com drone acima de `250g`.
- `SARPAS` obrigatorio quando `Missao exige SARPAS?` estiver em `Sim`.

Se algum requisito obrigatorio estiver sem data ou vencido, o app coloca o status em `NO-GO`.

## Integracao com UAV Forecast
Este app integra com a interface do UAV Forecast de duas formas:
- abertura direta da interface por URL (com lat/lon quando preenchidos),
- sincronizacao por payload JSON (copiado de automacoes/integacoes da sua operacao).

Isso permite incorporar dados do UAV Forecast na decisao de voo sem prender o app a um unico formato fixo de resposta.

## Observacoes
- O modelo de checklist vem de `checklist.json` (editavel sem mexer no codigo).
- Dados salvos no `localStorage` do navegador.
- O app funciona sem backend.
- Para operacao em equipe, recomenda-se versionar e evoluir para backend/API.
- Consulte `PRIVACIDADE.md` para nota de tratamento de dados (LGPD).
