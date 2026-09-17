# Previsão de Compras — Tiny ERP (via Vercel)

Este projeto roda **inteiramente na nuvem**, sem precisar instalar Python
nem nada na sua máquina. A Vercel executa as funções que falam com a API
do Tiny; você só acessa o site pelo navegador.

## O que tem aqui

- `api/produtos.js` — lista todos os produtos cadastrados no Tiny.
- `api/dados-tiny.js` — busca consumo (vendas), custo e histórico de compras
  por fornecedor, tudo em uma chamada.
- `public/index.html` — o dashboard (mesma tela de antes, agora com botões
  que consultam o Tiny ao vivo).

## Passo a passo para publicar

### 1. Gere um novo token no Tiny
⚠️ Se você já usou algum token em conversas de chat antes, **gere um novo**
agora (Tiny > Configurações > Extensões > Token API > gerar novo) e use
só esse novo daqui pra frente.

### 2. Coloque este projeto no GitHub
- Crie um repositório novo (pode ser privado) no GitHub.
- Suba esta pasta inteira para ele (pelo próprio site do GitHub, em
  "Add file > Upload files", arrastando todos os arquivos e pastas).

### 3. Importe na Vercel
1. Entre em https://vercel.com e faça login (dá pra usar sua conta do GitHub).
2. Clique em **Add New > Project**.
3. Escolha o repositório que você acabou de criar.
4. Antes de clicar em "Deploy", abra **Environment Variables** e adicione:
   - Nome: `TINY_API_TOKEN`
   - Valor: (cole seu token novo do Tiny aqui — fica criptografado, só o
     servidor da Vercel enxerga)
5. Clique em **Deploy**. Em ~1 minuto a Vercel te dá um link
   (algo como `seu-projeto.vercel.app`).

### 4. Use
Abra o link gerado. Clique em **"🔄 Buscar produtos no Tiny"** para ver
todos os produtos cadastrados, ou em **"🔄 Buscar consumo + custo +
histórico"** para trazer os dados que alimentam a previsão de compras.

## Observação sobre o estoque atual

A API do Tiny não retorna o saldo de estoque de forma padronizada para
todas as contas (depende de extensão habilitada). Por isso o campo
"estoque atual" chega zerado — você preenche manualmente na tabela do
dashboard (é só clicar e digitar; o cálculo de sugestão de compra
atualiza sozinho).

## Segurança

- O token fica só na variável de ambiente da Vercel — nunca aparece no
  código, no navegador ou em logs do site.
- Se em algum momento esse token aparecer em algum chat, print de tela
  ou lugar público, gere um novo imediatamente no Tiny.
