# Spec: NBA Legend-O-Meter (Live Season 25/26) 🏀

## 1. Visão Geral e Objetivo

Criar uma ferramenta de análise estatística interativa que utiliza **TensorFlow.js** para classificar o teto de carreira (potencial) de jogadores da NBA em seu segundo ano (Sophomores) na temporada 2025-26. 

A avaliação baseia-se exclusivamente em suas **estatísticas do ano de calouro (2024-25)**, comparando-as com o ano de estreia histórico das maiores lendas da NBA (ex: Michael Jordan em 1984-85, LeBron James em 2003-04). O objetivo é prever, com base nos números de estreia, qual o nível de grandeza (Tier) o jogador pode alcançar.

## 2. Arquitetura do Sistema (SSG Approach)

O projeto adota o padrão de **Static Site Generation (SSG)** focado em Machine Learning diretamente no navegador, garantindo performance extrema e custo zero de hospedagem:

* **Offline/CI (Data Pipeline):** Scripts em Node.js (executados localmente ou via GitHub Actions) para extração de dados de estatísticas, engenharia de features e treinamento prévio do modelo Keras/TensorFlow.
* **Static Host (GitHub Pages / Vercel):** Hospedagem estática dos assets (HTML, CSS, JS), banco de dados em JSON e binários do modelo treinado (`weights.bin` e `model.json`).
* **Client-Side Inferencing (Browser):** O navegador do usuário baixa o modelo treinado (via TensorFlow.js) e realiza inferências instantâneas localmente, sem depender de backends ou APIs externas (resolvendo problemas de latência e CORS).

---

## 3. Fluxo de Dados e Treinamento (Pipeline)

### 3.1. Pipeline de Geração de Dados (`scripts/build-data.js`)

O script de geração de dados executará em ambiente Node.js as seguintes etapas:

1. **Coleta de Histórico (Top 50 Legends):** Extração das estatísticas da temporada de calouro das lendas da NBA, servindo como a base de treinamento da IA.
2. **Coleta de Sophomores (Classe de 2024):** Extração das estatísticas da temporada de calouro (referentes à temporada 2024-25) dos atletas que são 2º anistas agora (2025-26).
3. **Engenharia de Features e Normalização:** Tratamento dos dados brutos e aplicação rigorosa de *Min-Max Scaling* nas métricas para o intervalo `[0, 1]`.
4. **Treinamento do Modelo:** Construção e treinamento da rede neural. O modelo é configurado para classificar a similaridade estatística em *Tiers* (ex: S, A, B, C, Bust).
5. **Exportação de Artefatos:** Geração dos arquivos estáticos para o frontend: `model.json` (topologia), `weights.bin` (pesos da rede) e `data/players.json` (banco de dados dos jogadores para consumo da UI).

### 3.2. Estrutura de Atributos (Features)

Para mitigar a inflação estatística entre eras diferentes da NBA e captar a contribuição em quadra com mais precisão, são usadas as seguintes métricas principais ajustadas/avançadas:

| Feature | Descrição | Justificativa |
| --- | --- | --- |
| **PTS_N** | Pontos por jogo (Normalizado) | Avalia o volume ofensivo de impacto de um novato. |
| **AST_N** | Assistências por jogo (Normalizado) | Mede a capacidade de playmaking e criação nativa. |
| **REB_N** | Rebotes por jogo (Normalizado) | Avalia a imposição física e presença no garrafão. |
| **TS_N** | True Shooting Percentage (Normalizado) | Reflete a eficiência real de arremesso global. |
| **PER_N** | Player Efficiency Rating (Normalizado) | Métrica holística clássica para sumarizar a eficiência de um jogador. |

---

## 4. UI/UX: Interface e Experiência do Usuário

O projeto consiste em uma única interface (SPA), desenhada em **HTML + CSS + ESM Nativo**, simplificando o escopo sem a necessidade de *bundlers* como Webpack ou Vite.

### 4.1. Visual Assets Oficiais (NBA CDN)

As imagens são renderizadas dinamicamente em tempo de execução injetando o ID do jogador/time em URLs públicas da NBA:

* **Player Headshot:** `https://ak-static.cms.nba.com/wp-content/uploads/headshots/nba/latest/260x190/${personId}.png`
* **Team Logo:** `https://cdn.nba.com/logos/nba/${teamId}/global/L/logo.svg`

*(Nota de Implementação: Sempre incluir fallbacks de imagem via `onerror` para IDs sem correspondência na CDN)*

### 4.2. Estados da Interface

O Client-Side deve gerenciar graciosamente os 3 estados principais da experiência:

1. **Bootstrapping (Loading):** Tela inicial com um *spinner* ou esqueleto abstrato até que `tf.loadLayersModel()` complete o download dos binários da IA.
2. **Explore (Search):** Interação central contendo um campo *autocomplete* ou lista amigável com seleção dos Sophomores extraídos de `players.json`.
3. **Veredito (Result):** Cartão expandido (Card Reveal) apresentando a foto e estatísticas do jogador, encabeçado pelo selo espetacular do seu **Tier / "Veredito da mIA"**, acompanhado da porcentagem de confiança.

---

## 5. Implementação Técnica (Frontend)

### 5.1. Estrutura de Diretórios Proposta

```text
/
├── index.html           # UI Shell (Dark Mode NBA style)
├── css/
│   └── styles.css       # Estilização modular (Glassmorphism + Neon accents)
├── js/
│   └── app.js           # Lógica de Inferência, Orquestração DOM (TF.js)
├── data/                # [Gerado pelo CI/CD dinamicamente, ignorado do GIT]
│   ├── model.json       # Topologia (Keras layer specs)
│   ├── weights.bin      # Pesos binários treinados
│   └── players.json     # Metadados estáticos contendo Sophomores
├── scripts/
│   └── build-data.js    # Data scraping, feature engineering e TF-Node training 
└── .github/
    └── workflows/
        └── deploy.yml   # Automação do pipeline (Cron job recomendado)
```

### 5.2. Dependências Fundamentais (via CDN)

* **TensorFlow.js (Core & Layers):** `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest/dist/tf.min.js`

---

## 6. Critérios de Sucesso e Validação

Para validar o protótipo local (e em Produção), a plataforma precisa alcançar a excelência em três métricas:

* **Latência de Inferência Local:** O tempo do cálculo da rede neural do predict local tem que ser < 50ms (imperceptível).
* **Acurácia Semântica Notável:** O modelo do Legend-O-Meter deve obrigatoriamente identificar anomalias estatísticas de excelência (ex: ano de calouro do Victor Wembanyama) com a classificação máxima (Tier S) numa confiança > 90%.
* **Experiência Responsiva e Imersiva:** Fluidez total do layout, tanto em dispositivos móveis (*Mobile First*) quanto em Desktop.
