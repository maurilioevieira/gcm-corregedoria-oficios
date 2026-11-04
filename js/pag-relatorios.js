/* ============================================================
   CORREGEDORIA · GCM IGUATU · CONTROLE DE OFÍCIOS
   js/pag-relatorios.js · Aba Relatórios (#relatorios)
   ------------------------------------------------------------
   Lado esquerdo: escolha do modelo e dos filtros.
   Lado direito: pré-visualização do PDF (no computador).
   No celular, o PDF é baixado direto (os navegadores de celular
   não mostram PDF dentro da página de forma confiável).

   Sigilo: para a Corregedoria/admin há a opção "incluir conteúdo
   dos sigilosos" (desmarcada por padrão, para que um relatório
   impresso ou encaminhado não exponha o assunto sem querer).
   Para o auxiliar, o banco já entrega o conteúdo oculto.
   ============================================================ */

(function () {
  'use strict';

  const U = App.util;
  const esc = U.esc;

  const MODELOS = [
    { id: 'lista',       nome: 'Ofícios por período',             desc: 'Lista completa com situação e prazos' },
    { id: 'pendencias',  nome: 'Pendências e vencidos',           desc: 'Só os em aberto, do prazo mais curto ao mais longo' },
    { id: 'consolidado', nome: 'Consolidado por origem e destino', desc: 'Totais, respostas no prazo e tempo médio de resposta' },
    { id: 'ficha',       nome: 'Ficha de um ofício',              desc: 'Dados completos, resposta e linha do tempo' }
  ];

  const SITUACOES = [
    { v: 'todos', n: 'Todas' }, { v: 'aberto', n: 'Em aberto' }, { v: 'vencido', n: 'Vencidos' },
    { v: 'respondido', n: 'Respondidos' }, { v: 'arquivado', n: 'Arquivados' }
  ];

  // Filtros guardados durante a sessão
  const f = {
    modelo: 'lista',
    de: null, ate: null,
    origem_id: '', destino_id: '', situacao: 'todos',
    sigilo: false, busca: ''
  };

  function nomeDe(lista, id, padrao) {
    const it = (lista || []).find(function (x) { return String(x.id) === String(id); });
    return it ? it.nome : padrao;
  }

  function opcoes(lista, sel, vazio) {
    return '<option value="">' + esc(vazio) + '</option>' + (lista || []).map(function (i) {
      return '<option value="' + i.id + '"' + (String(sel) === String(i.id) ? ' selected' : '') + '>' + esc(i.nome) + '</option>';
    }).join('');
  }

  function htmlFiltros(cad, podeGerir) {
    const periodo =
      '<div class="janela-grade">' +
        '<label class="campo">De<input type="date" id="rel-de" value="' + esc(f.de) + '"></label>' +
        '<label class="campo">Até<input type="date" id="rel-ate" value="' + esc(f.ate) + '"></label>' +
      '</div>';
    const origemDestino =
      '<label class="campo">Origem<select id="rel-origem">' + opcoes(cad.origens, f.origem_id, 'Todas') + '</select></label>' +
      '<label class="campo">Destino<select id="rel-destino">' + opcoes(cad.destinos, f.destino_id, 'Todos') + '</select></label>';
    const sigilo = podeGerir
      ? '<label class="marcador"><input type="checkbox" id="rel-sigilo"' + (f.sigilo ? ' checked' : '') + '>Incluir o conteúdo dos ofícios sigilosos</label>'
      : '';

    if (f.modelo === 'lista') {
      return periodo + '<p class="dica">Período de recebimento do ofício.</p>' + origemDestino +
        '<label class="campo">Situação<select id="rel-situacao">' + SITUACOES.map(function (s) {
          return '<option value="' + s.v + '"' + (f.situacao === s.v ? ' selected' : '') + '>' + s.n + '</option>'; }).join('') + '</select></label>' + sigilo;
    }
    if (f.modelo === 'pendencias') {
      return '<p class="dica">Mostra todos os ofícios ainda em aberto, de qualquer data.</p>' + origemDestino + sigilo;
    }
    if (f.modelo === 'consolidado') {
      return periodo + '<p class="dica">Considera os ofícios recebidos no período.</p>';
    }
    return '<label class="campo">Buscar o ofício<input type="search" id="rel-busca" value="' + esc(f.busca) + '" placeholder="Nº do ofício, assunto ou procedimento" autocomplete="off"></label>' +
      '<div id="rel-resultados" class="rel-resultados"><p class="dica">Digite para buscar. Também é possível gerar a ficha pelo botão "Imprimir ficha" na tela do ofício.</p></div>';
  }

  function textoFiltros(cad, incluiPeriodo, incluiSituacao) {
    const partes = [];
    if (incluiPeriodo) partes.push('Período de recebimento: ' + (f.de ? U.dataBR(f.de) : 'início') + ' a ' + (f.ate ? U.dataBR(f.ate) : 'hoje'));
    if (incluiPeriodo !== 'so') {
      partes.push('Origem: ' + nomeDe(cad.origens, f.origem_id, 'todas'));
      partes.push('Destino: ' + nomeDe(cad.destinos, f.destino_id, 'todos'));
    }
    if (incluiSituacao) partes.push('Situação: ' + (SITUACOES.find(function (s) { return s.v === f.situacao; }) || {}).n);
    return partes.join(' · ');
  }

  async function buscarLista(situacao, comPeriodo) {
    const r = await API.listarOficios({
      situacao: situacao,
      origem_id: f.origem_id || null,
      destino_id: f.destino_id || null,
      de: comPeriodo ? f.de : null,
      ate: comPeriodo ? f.ate : null,
      limite: 2000
    });
    return r.oficios || [];
  }

  async function renderizar(conteudo, ctx) {
    const cad = await U.comCarregando(function () { return App.cadastros(); });
    if (!ctx.ativa()) return;
    const podeGerir = ctx.usuario.nivel === 'admin' || ctx.usuario.nivel === 'corregedor';

    if (!f.de) { const h = U.hojeISO(); f.de = h.slice(0, 8) + '01'; f.ate = h; }

    conteudo.innerHTML = '<div class="pg-relatorios"></div>';
    const raiz = conteudo.firstElementChild;
    let baixarAtual = null;
    let urlAtual = null;

    function mostrarPrevia(url, baixar) {
      if (urlAtual) URL.revokeObjectURL(urlAtual);
      urlAtual = url; baixarAtual = baixar;
      raiz.querySelector('#rel-previa').innerHTML =
        '<div class="rel-previa-topo"><span>Pré-visualização</span>' +
          '<button type="button" class="botao primario pequeno" id="rel-baixar">Baixar PDF</button></div>' +
        '<iframe title="Pré-visualização do relatório" src="' + url + '"></iframe>';
      raiz.querySelector('#rel-baixar').addEventListener('click', function () { if (baixarAtual) baixarAtual(); });
    }

    function desenhar() {
      const temPlanilha = f.modelo === 'lista' || f.modelo === 'pendencias';
      raiz.innerHTML =
        '<header class="pagina-topo"><div>' +
          '<h1 class="pagina-titulo">Relatórios</h1>' +
          '<p class="texto-suave">Escolha o modelo, ajuste os filtros e gere o PDF com o timbre da Corregedoria.</p>' +
        '</div></header>' +
        '<div class="rel-layout">' +
          '<section class="rel-config">' +
            '<div class="cartao rel-bloco"><h2 class="cartao-titulo">1 · Modelo</h2>' +
              '<div class="rel-modelos" role="radiogroup" aria-label="Modelo de relatório">' +
              MODELOS.map(function (m) {
                const on = f.modelo === m.id;
                return '<label class="usr-nivel' + (on ? ' marcada' : '') + '"><input type="radio" name="modelo" value="' + m.id + '"' + (on ? ' checked' : '') + '>' +
                  '<span><strong>' + esc(m.nome) + '</strong><small>' + esc(m.desc) + '</small></span></label>';
              }).join('') +
              '</div></div>' +
            '<div class="cartao rel-bloco"><h2 class="cartao-titulo">2 · Filtros</h2>' + htmlFiltros(cad, podeGerir) + '</div>' +
            (f.modelo !== 'ficha'
              ? '<div class="rel-botoes">' +
                  '<button type="button" class="botao primario" id="rel-gerar">Gerar PDF</button>' +
                  (temPlanilha ? '<button type="button" class="botao secundario" id="rel-csv">Exportar planilha</button>' : '') +
                '</div>'
              : '') +
          '</section>' +
          '<section class="rel-previa" id="rel-previa" aria-live="polite">' +
            '<div class="rel-previa-vazia">' +
              '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>' +
              '<p>A pré-visualização do PDF aparece aqui.</p>' +
            '</div>' +
          '</section>' +
        '</div>';
      ligar();
    }

    function lerFiltros() {
      const v = function (id) { const el = raiz.querySelector(id); return el ? el.value : undefined; };
      if (v('#rel-de') !== undefined) { f.de = v('#rel-de') || null; f.ate = v('#rel-ate') || null; }
      if (v('#rel-origem') !== undefined) { f.origem_id = v('#rel-origem'); f.destino_id = v('#rel-destino'); }
      if (v('#rel-situacao') !== undefined) f.situacao = v('#rel-situacao');
      const sg = raiz.querySelector('#rel-sigilo'); if (sg) f.sigilo = sg.checked;
    }

    async function gerar(planilha) {
      lerFiltros();
      if ((f.modelo === 'lista' || f.modelo === 'consolidado') && f.de && f.ate && f.ate < f.de) {
        U.avisar('A data final do período não pode ser anterior à inicial.', 'erro'); return;
      }
      try {
        await U.comCarregando(async function () {
          if (f.modelo === 'lista') {
            const lista = (await buscarLista(f.situacao, true)).sort(function (a, b) {
              return String(a.data_recebimento).localeCompare(String(b.data_recebimento)) ||
                     String(a.numero_oficio).localeCompare(String(b.numero_oficio), 'pt-BR', { numeric: true });
            });
            if (planilha) PDF.csv(lista, f.sigilo);
            else await PDF.lista(lista, textoFiltros(cad, true, true), f.sigilo, mostrarPrevia);
          } else if (f.modelo === 'pendencias') {
            const lista = await buscarLista('aberto', false);
            if (planilha) PDF.csv(lista, f.sigilo);
            else await PDF.pendencias(lista, 'Posição em ' + U.dataBR(U.hojeISO()) + ' · ' + textoFiltros(cad, false, false), f.sigilo, mostrarPrevia);
          } else if (f.modelo === 'consolidado') {
            if (!f.de || !f.ate) throw new API.ErroAPI('Informe o período (de e até).');
            const dados = await API.relatorioConsolidado(f.de, f.ate);
            await PDF.consolidado(dados, 'Período de recebimento: ' + U.dataBR(f.de) + ' a ' + U.dataBR(f.ate), mostrarPrevia);
          }
        });
        if (planilha) U.avisar('Planilha gerada.', 'sucesso');
        else if (window.innerWidth < 900) U.avisar('PDF gerado. Confira seus downloads.', 'sucesso');
      } catch (e) { /* o aviso de erro já foi exibido */ }
    }

    // ----- Ficha: busca e geração -----
    let pedidoBusca = 0;
    async function buscarFicha(texto) {
      const area = raiz.querySelector('#rel-resultados');
      if (!texto) { area.innerHTML = '<p class="dica">Digite para buscar.</p>'; return; }
      const meu = ++pedidoBusca;
      let r;
      try { r = await API.listarOficios({ q: texto, situacao: 'todos', limite: 15 }); } catch (e) { U.avisar(e.message, 'erro'); return; }
      if (meu !== pedidoBusca || !ctx.ativa()) return;
      const lista = r.oficios || [];
      area.innerHTML = lista.length
        ? lista.map(function (o) {
            return '<div class="rel-resultado"><div><strong>Ofício nº ' + esc(o.numero_oficio) + '</strong>' +
              '<span>' + esc(o.assunto) + '</span><small>' + esc(o.origem_nome) + ' · ' + esc(Comp.seloPrazo(o)) + '</small></div>' +
              '<button type="button" class="botao secundario pequeno" data-ficha="' + esc(o.id) + '">Gerar ficha</button></div>';
          }).join('')
        : '<p class="dica">Nenhum ofício encontrado.</p>';
    }

    async function gerarFicha(id) {
      try {
        await U.comCarregando(async function () {
          const r = await API.obterOficio(id);
          await PDF.ficha(r.oficio, r.historico, mostrarPrevia);
        });
      } catch (e) { /* o aviso de erro já foi exibido */ }
    }

    function ligar() {
      raiz.querySelectorAll('input[name="modelo"]').forEach(function (r) {
        r.addEventListener('change', function () { lerFiltros(); f.modelo = r.value; desenhar(); });
      });
      const g = raiz.querySelector('#rel-gerar'); if (g) g.addEventListener('click', function () { gerar(false); });
      const c = raiz.querySelector('#rel-csv'); if (c) c.addEventListener('click', function () { gerar(true); });
      const b = raiz.querySelector('#rel-busca');
      if (b) {
        let espera = null;
        b.addEventListener('input', function () {
          clearTimeout(espera);
          const v = b.value.trim(); f.busca = v;
          espera = setTimeout(function () { buscarFicha(v); }, 350);
        });
        if (f.busca) buscarFicha(f.busca);
        b.focus();
      }
      // Baixa as bibliotecas de PDF em segundo plano, já adiantando a primeira geração
      PDF.carregarLibs().catch(function () {});
    }

    // Um único "ouvinte" para os botões "Gerar ficha" (o invólucro é fixo;
    // só o conteúdo dele é redesenhado ao trocar de modelo)
    raiz.addEventListener('click', function (e) {
      const bt = e.target.closest('[data-ficha]');
      if (bt) gerarFicha(bt.getAttribute('data-ficha'));
    });

    desenhar();
  }

  App.registrarPagina('relatorios', renderizar);
})();
