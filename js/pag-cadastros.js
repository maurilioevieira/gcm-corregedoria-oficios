/* ============================================================
   CORREGEDORIA · GCM IGUATU · CONTROLE DE OFÍCIOS
   js/pag-cadastros.js · Aba Cadastros (#cadastros)
   ------------------------------------------------------------
   Gerencia tudo o que aparece nas listas suspensas do formulário:
     • Origens e órgãos (duas colunas: escolhe a origem → vê os órgãos)
     • Destinos, Classificações, Formas de recebimento (lista simples)
     • Feriados (usados na contagem em dias úteis)

   Regras (as mesmas do banco):
     • Item já usado em ofício não pode ser excluído: só desativado.
     • Desativado some das listas do formulário, mas continua
       aparecendo nos ofícios antigos.
     • ▲ ▼ mudam a ordem da lista suspensa. A cada movimento a lista
       é renumerada de 10 em 10 (10, 20, 30…), o que deixa espaço para
       ajustes e evita empates de ordem.
   Acesso: Corregedoria e administrador (o banco confere de novo).
   ============================================================ */

(function () {
  'use strict';

  const U = App.util;
  const esc = U.esc;

  const ABAS = [
    { id: 'origens',            nome: 'Origens e órgãos' },
    { id: 'destinos',           nome: 'Destinos',              titulo: 'Destinos',              exemplo: 'Novo destino (ex.: Subcomando)' },
    { id: 'classificacoes',     nome: 'Classificações',        titulo: 'Classificações',        exemplo: 'Nova classificação' },
    { id: 'formas_recebimento', nome: 'Formas de recebimento', titulo: 'Formas de recebimento', exemplo: 'Nova forma (ex.: WhatsApp institucional)' },
    { id: 'feriados',           nome: 'Feriados' }
  ];

  // Lembra a aba e a origem escolhidas durante a sessão
  const estado = { aba: 'origens', origemId: null };

  const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  function diaSemana(iso) {
    const p = String(iso).split('-').map(Number);
    return DIAS[new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()];
  }

  function textoUso(n) {
    return n === 0 ? 'nunca usado' : 'usado em ' + n + ' ofício' + (n === 1 ? '' : 's');
  }

  const IC = {
    editar: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    ligar: '<path d="M18.4 6.6a9 9 0 1 1-12.8 0"/><path d="M12 2v10"/>',
    excluir: '<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/>',
    subir: '<path d="M18 15l-6-6-6 6"/>',
    descer: '<path d="M6 9l6 6 6-6"/>'
  };
  function svg(nome) {
    return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[nome] + '</svg>';
  }

  // ---------- Uma linha de item (origem, órgão ou lista simples) ----------
  function htmlItem(item, tipo, i, total, extras) {
    extras = extras || {};
    const usado = item.uso > 0;
    const cls = 'cad-item' + (extras.selecionado ? ' selecionado' : '') + (item.ativo ? '' : ' desativado');
    const nome = extras.selecionavel
      ? '<button type="button" class="cad-nome cad-nome-botao" data-acao="selecionar" data-id="' + item.id + '">' + esc(item.nome) +
          (extras.sub ? '<small>' + esc(extras.sub) + '</small>' : '') + '</button>'
      : '<span class="cad-nome">' + esc(item.nome) + '</span>';

    return (
      '<div class="' + cls + '" data-tipo="' + tipo + '" data-id="' + item.id + '">' +
        '<div class="cad-ordem">' +
          '<button type="button" class="cad-seta" data-acao="subir" aria-label="Subir ' + esc(item.nome) + '"' + (i === 0 ? ' disabled' : '') + '>' + svg('subir') + '</button>' +
          '<button type="button" class="cad-seta" data-acao="descer" aria-label="Descer ' + esc(item.nome) + '"' + (i === total - 1 ? ' disabled' : '') + '>' + svg('descer') + '</button>' +
        '</div>' +
        nome +
        (item.ativo ? '' : '<span class="cad-tag-off">Desativado</span>') +
        '<span class="cad-uso">' + textoUso(item.uso) + '</span>' +
        '<button type="button" class="cad-ic" data-acao="renomear" aria-label="Renomear ' + esc(item.nome) + '" title="Renomear">' + svg('editar') + '</button>' +
        '<button type="button" class="cad-ic" data-acao="alternar" aria-label="' + (item.ativo ? 'Desativar ' : 'Reativar ') + esc(item.nome) + '" title="' + (item.ativo ? 'Desativar' : 'Reativar') + '">' + svg('ligar') + '</button>' +
        '<button type="button" class="cad-ic perigo" data-acao="excluir" aria-label="Excluir ' + esc(item.nome) + '"' +
          (usado ? ' disabled title="Já usado: desative em vez de excluir"' : ' title="Excluir"') + '>' + svg('excluir') + '</button>' +
      '</div>'
    );
  }

  function htmlAdicionar(id, placeholder) {
    return '<form class="cad-adicionar" data-form="' + id + '">' +
      '<label class="sr-only" for="novo-' + id + '">' + esc(placeholder) + '</label>' +
      '<input id="novo-' + id + '" name="nome" maxlength="120" placeholder="' + esc(placeholder) + '" autocomplete="off">' +
      '<button type="submit" class="botao primario">Adicionar</button>' +
    '</form>';
  }

  // ===================== CONTEÚDO DE CADA ABA =====================

  function htmlOrigens(cad) {
    const origens = cad.origens || [];
    if (!estado.origemId || !origens.some(function (o) { return o.id === estado.origemId; })) {
      estado.origemId = origens.length ? origens[0].id : null;
    }
    const origemSel = origens.find(function (o) { return o.id === estado.origemId; });
    const orgaos = (cad.orgaos || []).filter(function (g) { return g.origem_id === estado.origemId; });

    const listaOrigens = origens.map(function (o, i) {
      const qtd = (cad.orgaos || []).filter(function (g) { return g.origem_id === o.id; }).length;
      return htmlItem(o, 'origens', i, origens.length, {
        selecionavel: true, selecionado: o.id === estado.origemId,
        sub: qtd === 0 ? 'nenhum órgão' : qtd + (qtd === 1 ? ' órgão' : ' órgãos')
      });
    }).join('');

    const listaOrgaos = orgaos.length
      ? orgaos.map(function (g, i) { return htmlItem(g, 'orgaos', i, orgaos.length); }).join('')
      : '<p class="cad-vazio">Nenhum órgão cadastrado para esta origem.</p>';

    return (
      '<div class="cad-colunas">' +
        '<section class="cartao cad-painel">' +
          '<h2 class="cartao-titulo">Origens</h2>' +
          htmlAdicionar('origens', 'Nova origem (ex.: Tribunal de Contas)') +
          '<div class="cad-lista">' + (listaOrigens || '<p class="cad-vazio">Nenhuma origem cadastrada.</p>') + '</div>' +
        '</section>' +
        '<section class="cartao cad-painel">' +
          (origemSel
            ? '<div class="cad-sobretitulo">Órgãos de</div><h2 class="cartao-titulo">' + esc(origemSel.nome) + '</h2>' +
              htmlAdicionar('orgaos', 'Novo órgão (ex.: 4ª Promotoria de Justiça de Iguatu)') +
              '<div class="cad-lista">' + listaOrgaos + '</div>' +
              '<p class="dica">Clique numa origem à esquerda para ver e cadastrar os órgãos dela.</p>'
            : '<p class="cad-vazio">Cadastre uma origem primeiro.</p>') +
        '</section>' +
      '</div>'
    );
  }

  function htmlSimples(cad, aba) {
    const lista = cad[aba.id] || [];
    return (
      '<section class="cartao cad-painel cad-estreito">' +
        '<h2 class="cartao-titulo">' + esc(aba.titulo) + '</h2>' +
        htmlAdicionar(aba.id, aba.exemplo) +
        '<div class="cad-lista">' +
          (lista.length
            ? lista.map(function (it, i) { return htmlItem(it, aba.id, i, lista.length); }).join('')
            : '<p class="cad-vazio">Nenhum item cadastrado.</p>') +
        '</div>' +
      '</section>'
    );
  }

  function htmlFeriados(cad) {
    const hoje = U.hojeISO();
    const lista = cad.feriados || [];
    const futuros = lista.filter(function (f) { return f.data >= hoje; });
    const passados = lista.filter(function (f) { return f.data < hoje; }).reverse();

    function linha(f) {
      return '<div class="cad-item feriado' + (f.data < hoje ? ' passado' : '') + '" data-data="' + esc(f.data) + '">' +
        '<span class="feriado-data">' + esc(U.dataBR(f.data)) + '</span>' +
        '<span class="feriado-dia">' + esc(diaSemana(f.data)) + '</span>' +
        '<span class="cad-nome">' + esc(f.descricao) + '</span>' +
        '<button type="button" class="cad-ic perigo" data-acao="excluir-feriado" aria-label="Excluir feriado de ' + esc(U.dataBR(f.data)) + '" title="Excluir">' + svg('excluir') + '</button>' +
      '</div>';
    }

    return (
      '<section class="cartao cad-painel cad-estreito">' +
        '<h2 class="cartao-titulo">Feriados</h2>' +
        '<p class="texto-suave">Usados só quando o prazo é contado em <strong>dias úteis</strong>. Inclua os feriados municipais de Iguatu e os pontos facultativos em que o expediente não funciona.</p>' +
        '<form class="cad-adicionar" data-form="feriados">' +
          '<label class="sr-only" for="novo-feriado-data">Data</label>' +
          '<input id="novo-feriado-data" type="date" name="data" required class="feriado-input-data">' +
          '<label class="sr-only" for="novo-feriado-desc">Descrição</label>' +
          '<input id="novo-feriado-desc" name="descricao" maxlength="120" placeholder="Descrição (ex.: feriado municipal)" required>' +
          '<button type="submit" class="botao primario">Adicionar</button>' +
        '</form>' +
        '<div class="cad-lista">' +
          (futuros.length ? futuros.map(linha).join('') : '<p class="cad-vazio">Nenhum feriado futuro cadastrado.</p>') +
        '</div>' +
        (passados.length
          ? '<details class="cad-passados"><summary>Feriados passados (' + passados.length + ')</summary><div class="cad-lista">' +
              passados.map(linha).join('') + '</div></details>'
          : '') +
      '</section>'
    );
  }

  // ===================== PÁGINA =====================
  async function renderizar(conteudo, ctx) {
    let cad = await U.comCarregando(function () { return API.listarCadastros(true); });
    if (!ctx.ativa()) return;

    conteudo.innerHTML = '<div class="pg-cadastros"></div>';
    const raiz = conteudo.firstElementChild;

    function desenhar() {
      const aba = ABAS.find(function (a) { return a.id === estado.aba; }) || ABAS[0];
      let corpo;
      if (aba.id === 'origens') corpo = htmlOrigens(cad);
      else if (aba.id === 'feriados') corpo = htmlFeriados(cad);
      else corpo = htmlSimples(cad, aba);

      raiz.innerHTML =
        '<header class="pagina-topo"><div>' +
          '<h1 class="pagina-titulo">Cadastros</h1>' +
          '<p class="texto-suave">Itens que aparecem nas listas suspensas do formulário de ofício.</p>' +
        '</div></header>' +
        '<div class="cad-abas" role="tablist" aria-label="Listas">' +
          ABAS.map(function (a) {
            const on = a.id === aba.id;
            return '<button type="button" role="tab" aria-selected="' + on + '" class="cad-aba' + (on ? ' ativa' : '') + '" data-aba="' + a.id + '">' + esc(a.nome) + '</button>';
          }).join('') +
        '</div>' +
        corpo +
        '<div class="cad-legenda">' +
          '<span><strong>▲ ▼</strong> ordem na lista suspensa</span>' +
          '<span><strong>Lápis</strong> renomear</span>' +
          '<span><strong>Liga/desliga</strong> desativar sem perder o histórico</span>' +
          '<span class="perigo"><strong>Lixeira</strong> só para itens nunca usados</span>' +
        '</div>';
    }

    // Recarrega do banco após qualquer alteração e atualiza a memória
    // usada pelo formulário de ofício (só itens ativos).
    async function atualizar() {
      cad = await API.listarCadastros(true);
      App.cadastros(true).catch(function () {});
      if (ctx.ativa()) desenhar();
    }

    async function executar(tarefa, mensagem) {
      try {
        await U.comCarregando(async function () { await tarefa(); await atualizar(); });
        if (mensagem) U.avisar(mensagem, 'sucesso');
      } catch (e) { /* aviso já exibido */ }
    }

    // ---------- Localiza o item pela linha clicada ----------
    function listaDoTipo(tipo) {
      if (tipo === 'orgaos') return (cad.orgaos || []).filter(function (g) { return g.origem_id === estado.origemId; });
      return cad[tipo] || [];
    }
    function salvarItem(tipo, item) {
      if (tipo === 'orgaos') return API.salvarOrgao(item);
      return API.salvarItemLista(tipo, item);
    }

    // ---------- Reordenar (▲ ▼) ----------
    async function mover(tipo, id, direcao) {
      const lista = listaDoTipo(tipo).slice();
      const i = lista.findIndex(function (x) { return x.id === id; });
      const j = i + direcao;
      if (i < 0 || j < 0 || j >= lista.length) return;
      const tmp = lista[i]; lista[i] = lista[j]; lista[j] = tmp;
      // Renumera 10, 20, 30… e salva só o que mudou
      const alterados = [];
      lista.forEach(function (x, pos) {
        const nova = (pos + 1) * 10;
        if (x.ordem !== nova) alterados.push(Object.assign({}, x, { ordem: nova }));
      });
      await executar(async function () {
        for (const x of alterados) { await salvarItem(tipo, x); }
      });
    }

    // ---------- Cliques ----------
    raiz.addEventListener('click', async function (e) {
      const botaoAba = e.target.closest('[data-aba]');
      if (botaoAba) { estado.aba = botaoAba.getAttribute('data-aba'); desenhar(); return; }

      const botao = e.target.closest('[data-acao]');
      if (!botao || botao.disabled) return;
      const acao = botao.getAttribute('data-acao');

      if (acao === 'excluir-feriado') {
        const data = botao.closest('[data-data]').getAttribute('data-data');
        if (await Comp.confirmar('Excluir feriado', 'Excluir o feriado de ' + U.dataBR(data) + '? Prazos já calculados não mudam.', 'Excluir', true)) {
          executar(function () { return API.excluirFeriado(data); }, 'Feriado excluído.');
        }
        return;
      }

      const linha = botao.closest('[data-tipo]');
      const tipo = linha.getAttribute('data-tipo');
      const id = Number(linha.getAttribute('data-id'));
      const item = listaDoTipo(tipo).find(function (x) { return x.id === id; }) ||
                   (cad[tipo] || []).find(function (x) { return x.id === id; });
      if (!item) return;

      if (acao === 'selecionar') {
        estado.origemId = id; desenhar();
      } else if (acao === 'subir' || acao === 'descer') {
        mover(tipo, id, acao === 'subir' ? -1 : 1);
      } else if (acao === 'renomear') {
        const v = await Comp.janela({
          titulo: 'Renomear',
          texto: 'O novo nome aparece também nos ofícios já cadastrados com este item.',
          corpo: '<label class="campo"><span>Nome <span class="obrig">*</span></span><input name="nome" maxlength="120" value="' + esc(item.nome) + '"></label>',
          botaoOk: 'Salvar',
          validar: function (v) { return v.nome ? '' : 'Informe o nome.'; }
        });
        if (v && v.nome !== item.nome) executar(function () { return salvarItem(tipo, Object.assign({}, item, { nome: v.nome })); }, 'Nome atualizado.');
      } else if (acao === 'alternar') {
        if (item.ativo && !(await Comp.confirmar('Desativar "' + item.nome + '"',
          'Ele deixa de aparecer nas listas do formulário. Os ofícios antigos continuam mostrando este item. Você pode reativar quando quiser.', 'Desativar'))) return;
        executar(function () { return salvarItem(tipo, Object.assign({}, item, { ativo: !item.ativo })); },
          item.ativo ? 'Item desativado.' : 'Item reativado.');
      } else if (acao === 'excluir') {
        if (await Comp.confirmar('Excluir "' + item.nome + '"', 'Esta ação não pode ser desfeita.', 'Excluir', true)) {
          executar(function () { return tipo === 'orgaos' ? API.excluirOrgao(id) : API.excluirItemLista(tipo, id); }, 'Item excluído.');
        }
      }
    });

    // ---------- Adicionar ----------
    raiz.addEventListener('submit', function (e) {
      const form = e.target.closest('[data-form]');
      if (!form) return;
      e.preventDefault();
      const tipo = form.getAttribute('data-form');

      if (tipo === 'feriados') {
        const data = form.elements.data.value;
        const descricao = form.elements.descricao.value.trim();
        if (!data || !descricao) { U.avisar('Informe a data e a descrição do feriado.', 'erro'); return; }
        executar(function () { return API.salvarFeriado(data, descricao); }, 'Feriado cadastrado.');
        return;
      }

      const nome = form.elements.nome.value.trim();
      if (!nome) { U.avisar('Digite o nome antes de adicionar.', 'erro'); form.elements.nome.focus(); return; }
      const lista = listaDoTipo(tipo);
      const ordem = (lista.reduce(function (m, x) { return Math.max(m, x.ordem || 0); }, 0)) + 10;
      const novo = tipo === 'orgaos'
        ? { origem_id: estado.origemId, nome: nome, ordem: ordem, ativo: true }
        : { nome: nome, ordem: ordem, ativo: true };
      executar(function () { return salvarItem(tipo, novo); }, '"' + nome + '" adicionado.');
    });

    desenhar();
  }

  App.registrarPagina('cadastros', renderizar);
})();
