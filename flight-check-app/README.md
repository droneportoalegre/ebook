# DroneOps Check App

Aplicativo web para checklist operacional de voo com:
- checklist por fases (pre-voo, documentacao, SARPAS, RETA, pos-voo),
- decisao automatica GO/NO-GO,
- consulta de clima (Open-Meteo),
- conector para interface UAV Forecast,
- registro operacional (piloto responsavel, cliente, log e incidentes),
- historico com filtros (busca, status e incidente),
- historico de voos,
- exportacao JSON e CSV.

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
