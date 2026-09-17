// GET /api/produtos -> lista TODOS os produtos cadastrados no Tiny (via API).
const BASE_URL = "https://api.tiny.com.br/api2";

async function chamarApi(endpoint, params, token) {
  const body = new URLSearchParams({ ...params, token, formato: "json" });
  const resp = await fetch(`${BASE_URL}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await resp.json();
  const retorno = data.retorno || {};
  if (retorno.status === "Erro") {
    const msgs = (retorno.erros || []).map((e) => e.erro).join("; ");
    throw new Error(`Erro na API (${endpoint}): ${msgs || "erro desconhecido"}`);
  }
  return retorno;
}

module.exports = async (req, res) => {
  const token = process.env.TINY_API_TOKEN;
  if (!token) {
    res.status(500).json({ erro: "TINY_API_TOKEN não configurado nas variáveis de ambiente da Vercel." });
    return;
  }

  try {
    const produtos = [];
    let pagina = 1;
    while (true) {
      const retorno = await chamarApi("produtos.pesquisa.php", { pesquisa: "", situacao: "A", pagina }, token);
      const lote = retorno.produtos || [];
      if (!lote.length) break;
      for (const item of lote) produtos.push(item.produto || item);
      const totalPaginas = parseInt(retorno.numero_paginas || pagina, 10);
      if (pagina >= totalPaginas) break;
      pagina++;
      if (pagina > 200) break;
    }
    res.status(200).json({ total: produtos.length, produtos });
  } catch (err) {
    res.status(502).json({ erro: err.message || "Falha ao consultar a API do Tiny." });
  }
};
