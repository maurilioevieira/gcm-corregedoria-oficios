/* ============================================================
   CORREGEDORIA · GCM IGUATU · CONTROLE DE OFÍCIOS
   js/pag-oficio.js · Detalhe do ofício (#oficio/id)
   ------------------------------------------------------------
   Mostra todos os dados, a resposta (se houver) e a linha do tempo.
   Ações, conforme o nível e a situação:
     • Editar               → quem pode editar (regra igual à do banco)
     • Registrar resposta   → ofício em aberto (abre direto se o
                              endereço terminar em /responder)
     • Reabrir / Excluir    → só Corregedoria e admin, com motivo
   Os botões são só conveniência: o banco confere a permissão de novo.
   ============================================================ */

(function () {
  'use strict';

  const U = App.util;
  const esc = U.esc;

  function linha(rotulo, valor, classe) {
    if (valor === null || valor === undefined || valor === '') valor = '—';
    return '<div class="dado' + (classe ? ' ' + classe : '') + '"><dt>' + esc(rotulo) + '</dt><dd>' + esc(valor) + '</dd></div>';
  }

  function textoPrazo(o) {
    if (o.prazo_dias === null || o.prazo_dias === undefined) return 'Data final informada diretamente';
    return o.prazo_dias + ' dia(s) ' + (o.prazo_tipo === 'uteis' ? 'úteis' : 'corridos');
  }

  const ICONE_HIST = {
    'Cadastrado': 'novo', 'Editado': 'editar', 'Respondido': 'ok', 'Arquivado': 'arquivo',
    'Reaberto': 'reabrir', 'Excluído': 'excluir'
  };

  function htmlHistorico(h) {
    if (!h || !h.length) return '<p class="texto-suave">Sem registros.</p>';
    return '<ol class="linha-tempo">' + h.map(function (i) {
      return '<li class="lt-item lt-' + (ICONE_HIST[i.acao] || 'novo') + '">' +
        '<div class="lt-topo"><strong>' + esc(i.acao) + '</strong>' +
        '<span>' + esc(U.dataHoraBR(i.em)) + (i.usuario ? ' · ' + esc(i.usuario) : '') + '</span></div>' +
        (i.detalhe ? '<div class="lt-detalhe">' + esc(i.detalhe) + '</div>' : '') +
      '</li>';
    }).join('') + '</ol>';
  }

  // ===================== AÇÕES =====================

  async function registrarResposta(o) {
    const v = await Comp.janela({
      titulo: 'Concluir ofício nº ' + o.numero_oficio,
      corpo:
        '<div class="opcoes-cartao" role="radiogroup" aria-label="Tipo de conclusão">' +
          '<label class="opcao-cartao marcada"><input type="radio" name="situacao" value="respondido" checked><span>Respondido</span></label>' +
          '<label class="opcao-cartao"><input type="radio" name="situacao" value="arquivado"><span>Arquivar sem resposta</span></label>' +
        '</div>' +
        '<div data-bloco="respondido" class="janela-grade">' +
          '<label class="campo">Nº do ofício de resposta<input name="resposta_numero" maxlength="60" placeholder="Ex.: 015/2026-CORREG"></label>' +
          '<label class="campo"><span>Data em que a resposta foi enviada <span class="obrig">*</span></span><input type="date" name="resposta_data" value="' + U.hojeISO() + '" max="' + U.hojeISO() + '"></label>' +
        '</div>' +
        '<label class="campo"><span data-rotulo-obs>Observação (opcional)</span>' +
          '<textarea name="obs" rows="3" maxlength="2000" placeholder="Ex.: resposta enviada por e-mail à Promotoria"></textarea></label>',
      botaoOk: 'Concluir',
      aoAbrir: function (form) {
        form.querySelectorAll('input[name="situacao"]').forEach(function (r) {
          r.addEventListener('change', function () {
            const arquivar = form.querySelector('input[name="situacao"]:checked').value === 'arquivado';
            form.querySelectorAll('.opcao-cartao').forEach(function (c) { c.classList.toggle('marcada', c.querySelector('input').checked); });
            form.querySelector('[data-bloco="respondido"]').hidden = arquivar;
            form.querySelector('[data-rotulo-obs]').textContent = arquivar ? 'Motivo do arquivamento *' : 'Observação (opcional)';
            form.querySelector('textarea[name="obs"]').placeholder = arquivar
              ? 'Ex.: ofício apenas para ciência, sem necessidade de resposta' : 'Ex.: resposta enviada por e-mail à Promotoria';
          });
        });
      },
      validar: function (v) {
        if (v.situacao === 'respondido' && !v.resposta_data) return 'Informe a data em que a resposta foi enviada.';
        if (v.situacao === 'respondido' && v.resposta_data < o.data_recebimento) return 'A data da resposta não pode ser anterior ao recebimento.';
        if (v.situacao === 'arquivado' && !v.obs) return 'Informe o motivo do arquivamento.';
        return '';
      }
    });
    if (!v) return false;
    await U.comCarregando(function () {
      return API.concluirOficio(o.id, v.situacao, v.resposta_numero, v.situacao === 'respondido' ? v.resposta_data : null, v.obs);
    });
    U.avisar(v.situacao === 'respondido' ? 'Resposta registrada.' : 'Ofício arquivado.', 'sucesso');
    return true;
  }

  async function pedirMotivo(titulo, texto, botaoOk, perigo) {
    const v = await Comp.janela({
      titulo: titulo, texto: texto, botaoOk: botaoOk, perigo: perigo,
      corpo: '<label class="campo"><span>Motivo <span class="obrig">*</span></span><textarea name="motivo" rows="3" maxlength="1000"></textarea></label>',
      validar: function (v) { return v.motivo ? '' : 'Informe o motivo.'; }
    });
    return v ? v.motivo : null;
  }

  // ===================== PÁGINA =====================
  async function renderizar(conteudo, ctx) {
    const partes = String(ctx.parametro || '').split('/');
    const id = partes[0];
    const abrirResposta = partes[1] === 'responder';

    const r = await U.comCarregando(function () { return API.obterOficio(id); });
    if (!ctx.ativa()) return;

    const o = r.oficio;
    const u = ctx.usuario;
    const podeGerir = u.nivel === 'admin' || u.nivel === 'corregedor';
    const aberto = o.situacao === 'aberto';
    const podeEditar = !o.mascarado && (podeGerir || (aberto && !o.sigiloso));
    const podeConcluir = aberto && !o.mascarado && (podeGerir || !o.sigiloso);

    const acoes =
      (podeConcluir ? '<button type="button" class="botao primario" data-acao="concluir">Registrar resposta</button>' : '') +
      (podeEditar ? '<a class="botao secundario" href="#editar/' + esc(o.id) + '">Editar</a>' : '') +
      (!aberto && podeGerir ? '<button type="button" class="botao secundario" data-acao="reabrir">Reabrir</button>' : '') +
      '<button type="button" class="botao secundario" data-acao="ficha">Imprimir ficha</button>' +
      (podeGerir ? '<button type="button" class="botao perigo" data-acao="excluir">Excluir</button>' : '');

    const origem = o.origem_nome + (o.orgao_nome ? ' · ' + o.orgao_nome : '');

    let blocoResposta = '';
    if (o.situacao === 'respondido') {
      blocoResposta =
        '<section class="cartao bloco-resposta">' +
          '<h2 class="cartao-titulo">Resposta enviada ' + Comp.resultadoPrazo(o) + '</h2>' +
          '<dl class="dados">' +
            linha('Nº do ofício de resposta', o.resposta_numero) +
            linha('Data de envio', U.dataBR(o.resposta_data)) +
            linha('Registrado por', o.concluido_por_nome) +
            linha('Observação', o.resposta_obs, 'dado-largo') +
          '</dl>' +
        '</section>';
    } else if (o.situacao === 'arquivado') {
      blocoResposta =
        '<section class="cartao bloco-resposta">' +
          '<h2 class="cartao-titulo">Arquivado sem resposta</h2>' +
          '<dl class="dados">' +
            linha('Data', U.dataBR(o.resposta_data)) +
            linha('Registrado por', o.concluido_por_nome) +
            linha('Motivo', o.resposta_obs, 'dado-largo') +
          '</dl>' +
        '</section>';
    }

    conteudo.innerHTML = '<div class="pg-oficio"></div>';
    const raiz = conteudo.firstElementChild;
    raiz.innerHTML =
      '<header class="pagina-topo"><div>' +
        '<a href="#painel" class="link-voltar">← Voltar ao painel</a>' +
        '<h1 class="pagina-titulo">Ofício nº ' + esc(o.numero_oficio) + '</h1>' +
      '</div><div class="pagina-acoes">' + acoes + '</div></header>' +

      '<section class="cabecalho-oficio t-' + esc(o.faixa) + '">' +
        '<div class="card-prazo">' +
          '<span class="pilula p-' + esc(o.faixa) + '">' + esc(Comp.seloPrazo(o)) + '</span>' +
          '<span class="card-prazo-data">prazo ' + esc(U.dataBR(o.data_limite)) + '</span>' +
        '</div>' +
        '<div class="card-corpo">' +
          '<div class="card-linha-topo">' + Comp.selos(o) + '</div>' +
          '<div class="cabecalho-assunto">' + esc(o.assunto) + '</div>' +
          '<div class="card-meta"><span><strong>Origem:</strong> ' + esc(origem) + '</span></div>' +
        '</div>' +
        '<div class="card-destino"><span class="card-destino-rotulo">Destino</span>' +
          '<span class="etiqueta-destino">' + esc(o.destino_nome) + '</span></div>' +
      '</section>' +

      (o.mascarado
        ? '<div class="aviso-sigilo">Ofício sigiloso: o conteúdo é visível somente para a Corregedoria.</div>'
        : '') +

      blocoResposta +

      '<div class="detalhe-grade">' +
        '<div class="detalhe-coluna">' +
          '<section class="cartao"><h2 class="cartao-titulo">Identificação</h2><dl class="dados">' +
            linha('Nº do ofício', o.numero_oficio) +
            linha('Origem', o.origem_nome) +
            linha('Órgão / unidade', o.orgao_nome) +
            linha('Procedimento de origem', o.procedimento) +
          '</dl></section>' +
          '<section class="cartao"><h2 class="cartao-titulo">Conteúdo</h2><dl class="dados">' +
            linha('Assunto', o.assunto, 'dado-largo') +
            linha('Resumo do pedido', o.resumo, 'dado-largo') +
            linha('Agente(s) citado(s)', o.agentes_citados) +
            linha('Classificação', o.classificacao_nome) +
          '</dl></section>' +
          '<section class="cartao"><h2 class="cartao-titulo">Encaminhamento e prazos</h2><dl class="dados">' +
            linha('Destino', o.destino_nome) +
            linha('Forma de recebimento', o.forma_recebimento_nome) +
            linha('Recebido por', o.recebido_por_nome) +
            linha('Data de recebimento', U.dataBR(o.data_recebimento)) +
            linha('Prazo concedido', textoPrazo(o)) +
            linha('Data final para resposta', U.dataBR(o.data_limite)) +
            linha('Urgente', o.urgente ? 'Sim' : 'Não') +
            linha('Sigiloso', o.sigiloso ? 'Sim' : 'Não') +
          '</dl></section>' +
          (o.mascarado ? '' :
            '<section class="cartao"><h2 class="cartao-titulo">Observações internas</h2>' +
              '<p class="texto-livre">' + esc(o.observacoes || '—') + '</p></section>') +
        '</div>' +
        '<div class="detalhe-coluna">' +
          '<section class="cartao"><h2 class="cartao-titulo">Linha do tempo</h2>' + htmlHistorico(r.historico) + '</section>' +
          '<p class="texto-suave rodape-detalhe">Cadastrado por ' + esc(o.criado_por_nome || '—') + ' em ' + esc(U.dataHoraBR(o.criado_em)) +
            (o.atualizado_em ? ' · última alteração em ' + esc(U.dataHoraBR(o.atualizado_em)) : '') + '</p>' +
        '</div>' +
      '</div>';

    // ----- Ações -----
    raiz.addEventListener('click', async function (e) {
      const botao = e.target.closest('[data-acao]');
      if (!botao) return;
      const acao = botao.getAttribute('data-acao');
      try {
        if (acao === 'ficha') {
          await U.comCarregando(function () { return PDF.ficha(o, r.historico, null); });
          U.avisar('Ficha gerada. Confira seus downloads.', 'sucesso');
        } else if (acao === 'concluir') {
          if (await registrarResposta(o)) App.navegar();
        } else if (acao === 'reabrir') {
          const motivo = await pedirMotivo('Reabrir ofício nº ' + o.numero_oficio,
            'A resposta registrada ficará guardada na linha do tempo e o ofício volta para "em aberto".', 'Reabrir');
          if (!motivo) return;
          await U.comCarregando(function () { return API.reabrirOficio(o.id, motivo); });
          U.avisar('Ofício reaberto.', 'sucesso');
          App.navegar();
        } else if (acao === 'excluir') {
          const motivo = await pedirMotivo('Excluir ofício nº ' + o.numero_oficio,
            'O ofício sai das listas e dos relatórios, mas o registro e o motivo ficam guardados no banco para auditoria.', 'Excluir', true);
          if (!motivo) return;
          await U.comCarregando(function () { return API.excluirOficio(o.id, motivo); });
          U.avisar('Ofício excluído.', 'sucesso');
          location.hash = '#painel';
        }
      } catch (erro) { /* o aviso de erro já foi mostrado */ }
    });

    // Veio do botão "Registrar resposta" do painel: abre a janela direto
    if (abrirResposta) {
      history.replaceState(null, '', '#oficio/' + o.id);
      if (podeConcluir) {
        try { if (await registrarResposta(o)) App.navegar(); } catch (erro) { /* aviso já exibido */ }
      }
    }
  }
  renderizar.titulo = 'Ofício';

  App.registrarPagina('oficio', renderizar);
})();
