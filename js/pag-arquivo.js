/* ============================================================
   CORREGEDORIA · GCM IGUATU · CONTROLE DE OFÍCIOS
   js/pag-arquivo.js · Arquivo (#arquivo): ofícios já concluídos
   ------------------------------------------------------------
   O Painel é a "mesa de trabalho" (o que falta responder). O Arquivo
   é a consulta do que já foi resolvido: respondidos e arquivados,
   do mais recente ao mais antigo, com indicação de "no prazo" ou
   "dias de atraso", útil para prestação de contas ao MP.
   ============================================================ */

(function () {
  'use strict';

  const U = App.util;
  const esc = U.esc;

  const filtros = { q: '', tipo: 'ambos', periodo: 'ano', destino_id: '' };

  const PERIODOS = [
    { valor: 'mes',   nome: 'Este mês' },
    { valor: '90',    nome: 'Últimos 90 dias' },
    { valor: 'ano',   nome: 'Este ano' },
    { valor: 'todos', nome: 'Qualquer data' }
  ];
  const TIPOS = [
    { valor: 'ambos',      nome: 'Respondidos e arquivados' },
    { valor: 'respondido', nome: 'Só respondidos' },
    { valor: 'arquivado',  nome: 'Só arquivados' }
  ];

  function somarDias(iso, dias) {
    const p = iso.split('-').map(Number);
    return new Date(Date.UTC(p[0], p[1] - 1, p[2] + dias)).toISOString().slice(0, 10);
  }
  function datas() {
    const hoje = U.hojeISO();
    if (filtros.periodo === 'mes') return { de: hoje.slice(0, 8) + '01', ate: hoje };
    if (filtros.periodo === '90') return { de: somarDias(hoje, -90), ate: hoje };
    if (filtros.periodo === 'ano') return { de: hoje.slice(0, 5) + '01-01', ate: hoje };
    return { de: null, ate: null };
  }

  async function buscar() {
    const d = datas();
    const base = { q: filtros.q || null, destino_id: filtros.destino_id || null, de: d.de, ate: d.ate, limite: 1000 };
    const tipos = filtros.tipo === 'ambos' ? ['respondido', 'arquivado'] : [filtros.tipo];
    const respostas = await Promise.all(tipos.map(function (t) {
      return API.listarOficios(Object.assign({}, base, { situacao: t }));
    }));
    const lista = [].concat.apply([], respostas.map(function (r) { return r.oficios || []; }));
    // Mais recente primeiro (pela data da conclusão)
    lista.sort(function (a, b) { return String(b.resposta_data || '').localeCompare(String(a.resposta_data || '')); });
    return lista;
  }

  function htmlResumo(lista) {
    const resp = lista.filter(function (o) { return o.situacao === 'respondido'; });
    const noPrazo = resp.filter(function (o) { return o.resposta_data <= o.data_limite; }).length;
    const atraso = resp.length - noPrazo;
    const arq = lista.length - resp.length;
    return '<div class="resumo-arquivo">' +
      '<span><strong>' + resp.length + '</strong> respondido(s)</span>' +
      '<span class="ok"><strong>' + noPrazo + '</strong> no prazo</span>' +
      '<span class="atraso"><strong>' + atraso + '</strong> com atraso</span>' +
      '<span><strong>' + arq + '</strong> arquivado(s) sem resposta</span>' +
    '</div>';
  }

  function htmlLista(lista) {
    if (!lista.length) {
      return '<div class="estado-vazio"><h2>Nenhum ofício concluído encontrado</h2><p>Ajuste o período ou a busca.</p></div>';
    }
    return htmlResumo(lista) +
      '<div class="lista-oficios">' + lista.map(function (o) { return Comp.htmlCard(o, { modo: 'arquivo' }); }).join('') + '</div>';
  }

  async function renderizar(conteudo, ctx) {
    const r = await U.comCarregando(function () { return Promise.all([App.cadastros(), buscar()]); });
    if (!ctx.ativa()) return;
    const cad = r[0];

    conteudo.innerHTML = '<div class="pg-arquivo"></div>';
    const raiz = conteudo.firstElementChild;
    raiz.innerHTML =
      '<header class="pagina-topo"><div>' +
        '<h1 class="pagina-titulo">Arquivo</h1>' +
        '<p class="texto-suave">Ofícios já respondidos ou arquivados, do mais recente ao mais antigo.</p>' +
      '</div></header>' +
      '<section class="cartao filtros" aria-label="Filtros do arquivo"><div class="filtros-linha">' +
        '<label class="campo campo-busca">Buscar<span class="busca-caixa">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>' +
          '<input type="search" id="arq-busca" value="' + esc(filtros.q) + '" placeholder="Assunto, nº, procedimento, origem…" autocomplete="off"></span></label>' +
        '<label class="campo">Situação<select id="arq-tipo">' + TIPOS.map(function (t) {
          return '<option value="' + t.valor + '"' + (filtros.tipo === t.valor ? ' selected' : '') + '>' + t.nome + '</option>'; }).join('') + '</select></label>' +
        '<label class="campo">Recebidos em<select id="arq-periodo">' + PERIODOS.map(function (p) {
          return '<option value="' + p.valor + '"' + (filtros.periodo === p.valor ? ' selected' : '') + '>' + p.nome + '</option>'; }).join('') + '</select></label>' +
        '<label class="campo">Destino<select id="arq-destino"><option value="">Todos</option>' + (cad.destinos || []).map(function (d) {
          return '<option value="' + d.id + '"' + (String(filtros.destino_id) === String(d.id) ? ' selected' : '') + '>' + esc(d.nome) + '</option>'; }).join('') + '</select></label>' +
      '</div></section>' +
      '<section id="arq-lista" aria-live="polite">' + htmlLista(r[1]) + '</section>';

    let pedido = 0;
    async function recarregar() {
      const meu = ++pedido;
      let lista;
      try { lista = await U.comCarregando(buscar); } catch (e) { return; }
      if (meu !== pedido || !ctx.ativa()) return;
      raiz.querySelector('#arq-lista').innerHTML = htmlLista(lista);
    }

    let espera = null;
    raiz.querySelector('#arq-busca').addEventListener('input', function (e) {
      clearTimeout(espera);
      const v = e.target.value.trim();
      espera = setTimeout(function () { if (v !== filtros.q) { filtros.q = v; recarregar(); } }, 350);
    });
    raiz.querySelector('#arq-tipo').addEventListener('change', function (e) { filtros.tipo = e.target.value; recarregar(); });
    raiz.querySelector('#arq-periodo').addEventListener('change', function (e) { filtros.periodo = e.target.value; recarregar(); });
    raiz.querySelector('#arq-destino').addEventListener('change', function (e) { filtros.destino_id = e.target.value; recarregar(); });
  }

  App.registrarPagina('arquivo', renderizar);
})();
