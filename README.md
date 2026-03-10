# 🏀 NBA Legend-O-Meter

Um aplicativo interativo via navegador que utiliza **Machine Learning** puro (`TensorFlow.js`) para comparar e classificar o teto de carreira de jogadores da NBA no seu segundo ano (Sophomores). Ele compara o desempenho deles em ambas as temporadas atuais (Ano 1 e Ano 2) com arquétipos lendários, permitindo visualizar a ascensão ou declínio do potencial daquela estrela.

Tudo calculado do lado do cliente (Client-Side Inferencing) de forma estática (SSG) com custo zero!

## 🧠 Como o Modelo de IA é Treinado?

Como a API oficial da NBA (stats.nba.com) **não** fornece uma "Classe" ou "Nota" objetiva de cada jogador e tem regras muito rígidas contra web scraping excessivo (*Rate Limiting*), foi adotada uma metodologia robusta e inteligente de **Geração Sintética Dirigida (Directed Synthetic Data Generation)**.

### A Metodologia de Geração de Dados (`build-data.js`)

1. **Definição de Arquétipos (Top Legends):**
   Ao invés de fazer milhares de chamadas de API para raspar os anos de estreia de todas as Lendas do passado (o que derrubaria o IP no GitHub Actions), nós declaramos manualmente no código o **arquétipo matemático real** da temporada de calouro que define cada prateleira de grandeza.
   
   *   **S-Tier (Hall of Fame / Generational):** Usamos como base ancorada os números reais de estreia de lendas monstruosas (ex: *Michael Jordan*: 28.2 PTS, 6.5 REB, 5.9 AST | *Victor Wembanyama*: 21.4 PTS, 10.6 REB, 3.6 BLK).
   *   **A-Tier (All-Star Caliber):** Baseados em excelentes estreias de jogadores dominantes, mas não "extraterrestres" no ano 1 (ex: *Carmelo Anthony*, *Damian Lillard*).
   *   **B-Tier (Solid Starters):** Números razoáveis na casa de 12-14 pontos, 4 rebotes ou assistências.
   *   **C-Tier (Rotation):** Estatísticas baixas da maior parte dos calouros não muito produtivos.
   *   **Bust-Tier:** Jogadores que lutam por minutos, na casa de 2 a 3 pontos por partida com péssima eficiência de arremesso.

2. **Engenharia de Features:**
   A IA não ingere números soltos. As estatísticas são transformadas em 5 super-variáveis dimensionadas (entre `0` e `1` usando `Min-Max Scaling`):
   *   `Volume Ofensivo (PTS)`
   *   `Criação (AST)`
   *   `Presença Interna (TRB)`
   *   `Eficiência Real (TS%)`
   *   `Métrica Holística (Mock PER - Player Efficiency Rating)`

3. **Geração de Ruído Algorítmico (Overfitting Protection):**
   Para ensinar a rede neural a generalizar um modelo complexo, pegamos esses perfis-raiz mapeados acima e clonamos eles injetando "Ruído Estatístico" — variamos os números para cima e para baixo em até ±15% aleatoriamente em loop.
   Dessa forma, criamos um banco de dados de treino com **200+ cenários realistas e perfeitamente classificados sem fazer nenhuma requisição na API da NBA para o passado**, e treinamos a rede neural (`model.fit`) em cima desses dados, gerando o arquivo `weights.bin`.

### O Lado do Usuário (Client)

*   **Extração Ativa:** O servidor, através de cronjobs, busca a lista e os status **100% reais e atualizados** de todos os "Sophomores" (segundo-anistas) da temporada em vigor na API da NBA, tanto os dados de seus anos de *Calouro*, quanto os de *Sophomore*. Isso sim é salvo em um arquivo leve `JSON`.
*   **Inferência:** Seu navegador baixa os `Pesos Treinados` e os `Dados dos Sophomores` atuais, une as duas coisas no `TensorFlow.js` em memória do lado do navegador e calcula: Qual modelo de Lenda esse Sophomore mais se parece baseado nas estatísticas? Mágica Feita.

## 🚀 Como Executar Localmente

### Pré-requisitos
*   Node.js v18+

### Instruções

1. Clone o repositório e instale as dependências.
   ```bash
   npm install
   ```
2. (Opcional) Gere (Treine) você mesmo um modelo novinho atualizado com dados recentes da API da NBA para garantir que esteja vendo números frescos da temporada.
   ```bash
   npm run build
   ```
3. Suba um servidor de arquivos simples. Como o projeto usa JavaScript moderno com ES Modules nativo no navegador, abrir o arquivo `.html` diretamente com dois cliques (`file://`) causará erro de CORS. Use o Serve:
   ```bash
   npx serve .
   ```
4. Abra o link gerado (geralmente `http://localhost:3000`) em seu navegador e a IA calculará tudo na hora para você!
