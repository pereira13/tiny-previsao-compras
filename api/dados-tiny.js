// Função serverless da Vercel: consulta a API do Tiny (api2) do lado do
// servidor (por isso funciona -- o navegador não pode chamar a API do
// Tiny diretamente por causa de CORS/segurança, mas o servidor pode).
//
// O token NUNCA fica no código. Ele é lido de uma variável de ambiente
// (TINY_API_TOKEN) configurada no painel da Vercel, em:
//   Project Settings > Environment Variables

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

function paraFloat(valor) {
  if (valor === undefined || valor === null) return 0;
  const s = String(valor);
  const n = s.includes(",") ? parseFloat(s.replace(/\./g, "").replace(",", ".")) : parseFloat(s);
  return isNaN(n) ? 0 : n;
}

async function buscarProdutos(token) {
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
    if (pagina > 200) break; // trava de segurança
  }
  return produtos;
}

async function buscarContasPagar(token, dataIni, dataFim) {
  const contas = [];
  let pagina = 1;
  while (true) {
    const retorno = await chamarApi(
      "contas.pagar.pesquisa.php",
      { data_ini_emissao: dataIni, data_fim_emissao: dataFim, pagina },
      token
    );
    const lote = retorno.contas || [];
    if (!lote.length) break;
    for (const item of lote) contas.push(item.conta || item);
    pagina++;
    if (pagina > 200) break;
  }
  return contas;
}

async function buscarPedidosVenda(token, dataIni, dataFim) {
  const pedidos = [];
  let pagina = 1;
  while (true) {
    const retorno = await chamarApi(
      "pedidos.pesquisa.php",
      { dataInicial: dataIni, dataFinal: dataFim, pagina },
      token
    );
    const lote = retorno.pedidos || [];
    if (!lote.length) break;
    for (const item of lote) pedidos.push(item.pedido || item);
    pagina++;
    if (pagina > 300) break;
  }
  return pedidos;
}

function calcularConsumoPorProduto(pedidos) {
  const consumo = {};
  for (const pedido of pedidos) {
    for (const itemWrap of pedido.itens || []) {
      const item = itemWrap.item || itemWrap;
      const codigo = item.codigo;
      if (!codigo) continue;
      consumo[codigo] = (consumo[codigo] || 0) + paraFloat(item.quantidade);
    }
  }
  return consumo;
}

function agregarPorFornecedorMes(contas) {
  const agregados = {};
  for (const c of contas) {
    const fornecedor = c.nome_cliente || "Fornecedor não identificado";
    const dataRef = c.data_emissao || c.data || "";
    const partes = dataRef.split("/");
    const mesAno = partes.length === 3 ? `${partes[1]}/${partes[2]}` : "sem_data";
    const chave = `${fornecedor}||${mesAno}`;
    if (!agregados[chave]) agregados[chave] = { fornecedor, mes: mesAno, total_comprado: 0, quantidade_lancamentos: 0 };
    agregados[chave].total_comprado += paraFloat(c.valor);
    agregados[chave].quantidade_lancamentos += 1;
  }
  return Object.values(agregados).sort((a, b) => a.fornecedor.localeCompare(b.fornecedor));
}

function formatarData(d) {
  return d.toLocaleDateString("pt-BR");
}

module.exports = async (req, res) => {
  const token = process.env.TINY_API_TOKEN;
  if (!token) {
    res.status(500).json({ erro: "TINY_API_TOKEN não configurado nas variáveis de ambiente da Vercel." });
    return;
  }

  const mesesFinanceiro = parseInt(req.query.meses || "12", 10);
  const diasConsumo = parseInt(req.query.dias || "90", 10);

  const hoje = new Date();
  const iniFin = new Date(hoje);
  iniFin.setDate(iniFin.getDate() - 30 * mesesFinanceiro);
  const iniVendas = new Date(hoje);
  iniVendas.setDate(iniVendas.getDate() - diasConsumo);

  try {
    const [produtos, contas, pedidos] = await Promise.all([
      buscarProdutos(token),
      buscarContasPagar(token, formatarData(iniFin), formatarData(hoje)),
      buscarPedidosVenda(token, formatarData(iniVendas), formatarData(hoje)),
    ]);

    const consumoPorCodigo = calcularConsumoPorProduto(pedidos);
    const historicoPorFornecedor = agregarPorFornecedorMes(contas);

    const produtosConsumo = produtos.map((p) => {
      const qtdVendida = consumoPorCodigo[p.codigo] || 0;
      return {
        codigo: p.codigo,
        nome: p.nome,
        preco_custo: paraFloat(p.preco_custo),
        estoque_atual: null, // ver observação no README sobre saldo de estoque
        quantidade_vendida_periodo: qtdVendida,
        dias_periodo: diasConsumo,
        consumo_diario: diasConsumo ? +(qtdVendida / diasConsumo).toFixed(4) : 0,
      };
    });

    res.status(200).json({
      gerado_em: hoje.toLocaleString("pt-BR"),
      periodo_financeiro: { de: formatarData(iniFin), ate: formatarData(hoje) },
      periodo_consumo: { de: formatarData(iniVendas), ate: formatarData(hoje), dias: diasConsumo },
      historico_por_fornecedor: historicoPorFornecedor,
      produtos_consumo: produtosConsumo,
      total_produtos: produtos.length,
    });
  } catch (err) {
    res.status(502).json({ erro: err.message || "Falha ao consultar a API do Tiny." });
  }
};
