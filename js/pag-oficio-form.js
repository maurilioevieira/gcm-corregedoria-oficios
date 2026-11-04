/* ============================================================
   CORREGEDORIA · GCM IGUATU · CONTROLE DE OFÍCIOS
   js/pag-oficio-form.js · Cadastrar (#novo) e editar (#editar/id)
   ------------------------------------------------------------
   Decisões:
   • Todas as listas vêm da aba Cadastros (nada fixo no código).
   • O órgão depende da origem: escolheu "Ministério Público",
     a lista de órgãos mostra só as promotorias.
   • A data final é calculada pelo BANCO (que conhece os feriados
     cadastrados) sempre que mudar recebimento, dias ou contagem.
     Ela continua editável para ofícios com data final expressa.
   • Ao lado, uma prévia mostra como o card vai aparecer no painel.
   • O banco valida tudo de novo ao salvar: a validação daqui é só
     para avisar mais cedo.
   ============================================================ */

(function () {
  'use strict';

  const U = App.util;
  const esc = U.esc;

  function opcoes(lista, selecionado, vazio) {
    return (vazio !== undefined ? '<option value="">' + esc(vazio) + '</option>' : '') +
      (lista || []).map(function (i) {
        return '<option value="' + i.id + '"' + (String(selecionado) === String(i.id) ? ' selected' : '') + '>' + esc(i.nome) + '</option>';
      }).join('');
  }

  // Inclui na lista um item desativado que o ofício já usa (senão o
  // campo apareceria vazio ao editar um ofício antigo).
  function garantirItem(lista, id, nome) {
    if (!id || (lista || []).some(function (i) { return String(i.id) === String(id); })) return lista || [];
    return (lista || []).concat([{ id: id, nome: (nome || 'Item desativado') + ' (desativado)' }]);
  }

  // ===================== HTML DO FORMULÁRIO =====================
  function htmlFormulario(o, cad, usuario, edicao) {
    const podeGerir = usuario.nivel === 'admin' || usuario.nivel === 'corregedor';
    const origens = garantirItem(cad.origens, o.origem_id, o.origem_nome);
    const destinos = garantirItem(cad.destinos, o.destino_id, o.destino_nome);
    const classes = garantirItem(cad.classificacoes, o.classificacao_id, o.classificacao_nome);
    const formas = garantirItem(cad.formas_recebimento, o.forma_recebimento_id, o.forma_recebimento_nome);
    const usuarios = garantirItem(cad.usuarios, o.recebido_por, o.recebido_por_nome);

    const radiosDestino = destinos.map(function (d) {
      const marcado = String(o.destino_id) === String(d.id);
      return '<label class="opcao-cartao' + (marcado ? ' marcada' : '') + '">' +
        '<input type="radio" name="destino_id" value="' + d.id + '"' + (marcado ? ' checked' : '') + ' required>' +
        '<span>' + esc(d.nome) + '</span></label>';
    }).join('');

    const avisoSigilo = edicao && !podeGerir
      ? '<p class="dica">Somente a Corregedoria pode marcar ou retirar o sigilo de um ofício já cadastrado.</p>'
      : '<p class="dica">Depois de salvo, um ofício sigiloso só pode ser editado pela Corregedoria, e o auxiliar vê apenas número, origem, destino e prazo.</p>';

    return (
      '<form id="form-oficio" class="form-oficio" novalidate>' +

        // 1 · Identificação
        '<fieldset class="bloco">' +
          '<legend>1 · Identificação</legend>' +
          '<div class="grade">' +
            '<label class="campo"><span>Nº do ofício recebido <span class="obrig">*</span></span>' +
              '<input name="numero_oficio" required maxlength="60" value="' + esc(o.numero_oficio) + '" placeholder="Ex.: 415/2026"></label>' +
            '<label class="campo"><span>Origem <span class="obrig">*</span></span>' +
              '<select name="origem_id" required>' + opcoes(origens, o.origem_id, 'Selecione…') + '</select></label>' +
            '<label class="campo">Órgão / unidade de origem' +
              '<select name="orgao_id"></select>' +
              '<span class="dica" id="dica-orgao"></span></label>' +
            '<label class="campo">Nº do procedimento de origem' +
              '<input name="procedimento" maxlength="120" value="' + esc(o.procedimento) + '" placeholder="NF, PA, IC, processo, inquérito…"></label>' +
          '</div>' +
        '</fieldset>' +

        // 2 · Conteúdo
        '<fieldset class="bloco">' +
          '<legend>2 · Conteúdo</legend>' +
          '<label class="campo"><span>Assunto <span class="obrig">*</span></span>' +
            '<input name="assunto" required maxlength="300" value="' + esc(o.assunto) + '" placeholder="Resumo do pedido em uma linha"></label>' +
          '<label class="campo">Resumo do que foi solicitado' +
            '<textarea name="resumo" rows="3" maxlength="4000">' + esc(o.resumo) + '</textarea></label>' +
          '<div class="grade">' +
            '<label class="campo">Agente(s) citado(s)' +
              '<input name="agentes_citados" maxlength="500" value="' + esc(o.agentes_citados) + '" placeholder="Nome, QRA ou matrícula"></label>' +
            '<label class="campo">Classificação' +
              '<select name="classificacao_id">' + opcoes(classes, o.classificacao_id, '—') + '</select></label>' +
          '</div>' +
        '</fieldset>' +

        // 3 · Encaminhamento
        '<fieldset class="bloco">' +
          '<legend>3 · Encaminhamento</legend>' +
          '<div class="campo"><span>Destino <span class="obrig">*</span></span>' +
            '<div class="opcoes-cartao" role="radiogroup" aria-label="Destino">' + radiosDestino + '</div></div>' +
          '<div class="grade">' +
            '<label class="campo">Recebido por' +
              '<select name="recebido_por">' + opcoes(usuarios, o.recebido_por || usuario.id) + '</select></label>' +
            '<label class="campo">Forma de recebimento' +
              '<select name="forma_recebimento_id">' + opcoes(formas, o.forma_recebimento_id, '—') + '</select></label>' +
          '</div>' +
        '</fieldset>' +

        // 4 · Prazos
        '<fieldset class="bloco">' +
          '<legend>4 · Prazos</legend>' +
          '<div class="grade grade-4">' +
            '<label class="campo"><span>Data de recebimento <span class="obrig">*</span></span>' +
              '<input type="date" name="data_recebimento" required max="' + U.hojeISO() + '" value="' + esc(o.data_recebimento) + '"></label>' +
            '<label class="campo">Prazo concedido (dias)' +
              '<input type="number" name="prazo_dias" min="0" max="365" inputmode="numeric" value="' + esc(o.prazo_dias == null ? '' : o.prazo_dias) + '"></label>' +
            '<label class="campo">Contagem' +
              '<select name="prazo_tipo">' +
                '<option value="corridos"' + (o.prazo_tipo !== 'uteis' ? ' selected' : '') + '>Dias corridos</option>' +
                '<option value="uteis"' + (o.prazo_tipo === 'uteis' ? ' selected' : '') + '>Dias úteis</option>' +
              '</select></label>' +
            '<label class="campo"><span>Data final para resposta <span class="obrig">*</span></span>' +
              '<input type="date" name="data_limite" required class="destaque-dourado" value="' + esc(o.data_limite) + '">' +
              '<span class="dica" id="dica-limite">Calculada pelo prazo · pode ser ajustada</span></label>' +
          '</div>' +
          '<div class="marcadores">' +
            '<label class="marcador"><input type="checkbox" name="urgente"' + (o.urgente ? ' checked' : '') + '>Urgente</label>' +
            '<label class="marcador"><input type="checkbox" name="sigiloso"' + (o.sigiloso ? ' checked' : '') +
              (edicao && !podeGerir ? ' disabled' : '') + '>Sigiloso</label>' +
          '</div>' +
          avisoSigilo +
        '</fieldset>' +

        // 5 · Observações
        '<fieldset class="bloco">' +
          '<legend>5 · Observações internas</legend>' +
          '<label class="campo"><span class="sr-only">Observações</span>' +
            '<textarea name="observacoes" rows="2" maxlength="4000" placeholder="Anotações da equipe (não saem no relatório)">' + esc(o.observacoes) + '</textarea></label>' +
          '<p class="dica">Depois de salvar, anexe o ofício digitalizado (PDF ou foto) na tela do ofício, em "Anexos".</p>' +
        '</fieldset>' +

        '<div class="form-botoes">' +
          '<a class="botao secundario" href="' + (edicao ? '#oficio/' + esc(o.id) : '#painel') + '">Cancelar</a>' +
          '<button type="submit" class="botao primario" id="botao-salvar">' + (edicao ? 'Salvar alterações' : 'Salvar ofício') + '</button>' +
        '</div>' +
      '</form>'
    );
  }

  function htmlPrevia() {
    return (
      '<aside class="previa" aria-label="Pré-visualização">' +
        '<div class="previa-caixa">' +
          '<div class="previa-titulo">Como vai aparecer no painel</div>' +
          '<div class="previa-card t-verde" id="previa-card">' +
            '<span class="pilula p-verde" id="previa-pilula">—</span>' +
            '<div class="previa-numero" id="previa-numero">Ofício nº —</div>' +
            '<div class="previa-assunto" id="previa-assunto">Assunto do ofício</div>' +
            '<div class="previa-meta" id="previa-meta">Origem → Destino</div>' +
          '</div>' +
        '</div>' +
        '<div class="cartao regra-cores">' +
          '<h2 class="cartao-titulo">Regra das cores</h2>' +
          '<p><i class="ponto p-verde"></i>5 dias ou mais até o prazo</p>' +
          '<p><i class="ponto p-laranja"></i>Faltam 3 ou 4 dias</p>' +
          '<p><i class="ponto p-vermelho"></i>Faltam 2 dias ou menos</p>' +
          '<p><i class="ponto p-vencido"></i>Prazo vencido</p>' +
        '</div>' +
      '</aside>'
    );
  }

  // ===================== COMPORTAMENTO =====================
  function ligar(raiz, o, cad, edicao) {
    const form = raiz.querySelector('#form-oficio');
    const campo = function (nome) { return form.elements[nome]; };

    // ----- Órgãos conforme a origem -----
    function atualizarOrgaos(manterSelecao) {
      const origemId = campo('origem_id').value;
      const seletor = campo('orgao_id');
      const dica = raiz.querySelector('#dica-orgao');
      const atual = manterSelecao ? (seletor.value || o.orgao_id) : '';
      let lista = (cad.orgaos || []).filter(function (g) { return String(g.origem_id) === String(origemId); });
      if (manterSelecao) lista = garantirItem(lista, o.orgao_id && String(o.origem_id) === String(origemId) ? o.orgao_id : null, o.orgao_nome);

      if (!origemId) {
        seletor.innerHTML = '<option value="">Escolha a origem primeiro</option>';
        seletor.disabled = true; dica.textContent = '';
      } else if (!lista.length) {
        seletor.innerHTML = '<option value="">Nenhum órgão cadastrado</option>';
        seletor.disabled = true;
        dica.textContent = App.podeVer('cadastros')
          ? 'Cadastre os órgãos desta origem na aba Cadastros.'
          : 'Peça à Corregedoria para cadastrar os órgãos desta origem.';
      } else {
        seletor.innerHTML = opcoes(lista, atual, '— Não informado —');
        seletor.disabled = false; dica.textContent = '';
      }
    }
    campo('origem_id').addEventListener('change', function () { atualizarOrgaos(false); atualizarPrevia(); });
    atualizarOrgaos(true);

    // ----- Destino em cartões -----
    form.querySelectorAll('input[name="destino_id"]').forEach(function (r) {
      r.addEventListener('change', function () {
        form.querySelectorAll('.opcao-cartao').forEach(function (c) {
          c.classList.toggle('marcada', c.querySelector('input').checked);
        });
        atualizarPrevia();
      });
    });

    // ----- Cálculo da data final (pelo banco, que conhece os feriados) -----
    let pedidoCalculo = 0;
    let espera = null;
    function recalcularLimite() {
      clearTimeout(espera);
      espera = setTimeout(async function () {
        const receb = campo('data_recebimento').value;
        const dias = campo('prazo_dias').value;
        if (!receb || dias === '') return;
        const meu = ++pedidoCalculo;
        try {
          const r = await API.calcularDataLimite(receb, dias, campo('prazo_tipo').value);
          if (meu !== pedidoCalculo) return;
          campo('data_limite').value = r.data_limite;
          raiz.querySelector('#dica-limite').textContent =
            'Calculada: ' + dias + ' dia(s) ' + (campo('prazo_tipo').value === 'uteis' ? 'úteis' : 'corridos') + ' · pode ser ajustada';
          atualizarPrevia();
        } catch (e) {
          U.avisar(e.message, 'erro');
        }
      }, 300);
    }
    ['data_recebimento', 'prazo_dias', 'prazo_tipo'].forEach(function (n) {
      campo(n).addEventListener('input', recalcularLimite);
      campo(n).addEventListener('change', recalcularLimite);
    });
    campo('data_limite').addEventListener('input', function () {
      raiz.querySelector('#dica-limite').textContent = 'Data ajustada manualmente';
      atualizarPrevia();
    });

    // ----- Prévia do card -----
    function textoSelecionado(sel) {
      return sel && sel.selectedIndex >= 0 && sel.value ? sel.options[sel.selectedIndex].text : '';
    }
    function atualizarPrevia() {
      const limite = campo('data_limite').value;
      // Sem prazo definido, a prévia fica cinza (neutra) em vez de verde
      const f = limite ? Comp.faixaLocal(limite) : { faixa: 'respondido', dias: null };
      const card = raiz.querySelector('#previa-card');
      const pilula = raiz.querySelector('#previa-pilula');
      card.className = 'previa-card t-' + f.faixa;
      pilula.className = 'pilula p-' + f.faixa;
      pilula.textContent = limite
        ? Comp.seloPrazo({ situacao: 'aberto', dias_restantes: f.dias }) + ' · ' + U.dataCurtaBR(limite)
        : 'Defina o prazo';
      raiz.querySelector('#previa-numero').textContent = 'Ofício nº ' + (campo('numero_oficio').value.trim() || '—');
      raiz.querySelector('#previa-assunto').textContent = campo('assunto').value.trim() || 'Assunto do ofício';
      const destino = form.querySelector('input[name="destino_id"]:checked');
      const origem = textoSelecionado(campo('origem_id'));
      const orgao = textoSelecionado(campo('orgao_id'));
      raiz.querySelector('#previa-meta').textContent =
        (origem || 'Origem') + (orgao && orgao.indexOf('—') !== 0 ? ' · ' + orgao : '') + ' → ' +
        (destino ? destino.parentNode.textContent : 'Destino');
    }
    ['numero_oficio', 'assunto', 'orgao_id'].forEach(function (n) {
      campo(n).addEventListener('input', atualizarPrevia);
      campo(n).addEventListener('change', atualizarPrevia);
    });
    atualizarPrevia();

    // ----- Salvar -----
    let salvando = false;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (salvando) return;

      const faltando = [];
      if (!campo('numero_oficio').value.trim()) faltando.push('número do ofício');
      if (!campo('origem_id').value) faltando.push('origem');
      if (!campo('assunto').value.trim()) faltando.push('assunto');
      if (!form.querySelector('input[name="destino_id"]:checked')) faltando.push('destino');
      if (!campo('data_recebimento').value) faltando.push('data de recebimento');
      if (!campo('data_limite').value) faltando.push('data final para resposta');
      if (faltando.length) {
        U.avisar('Preencha: ' + faltando.join(', ') + '.', 'erro');
        return;
      }
      if (campo('data_recebimento').value > U.hojeISO()) {
        U.avisar('A data de recebimento não pode ser uma data futura.', 'erro');
        return;
      }
      if (campo('data_limite').value < campo('data_recebimento').value) {
        U.avisar('A data final não pode ser anterior ao recebimento.', 'erro');
        return;
      }

      const dados = {
        numero_oficio: campo('numero_oficio').value.trim(),
        origem_id: campo('origem_id').value,
        orgao_id: campo('orgao_id').disabled ? '' : campo('orgao_id').value,
        procedimento: campo('procedimento').value,
        assunto: campo('assunto').value,
        resumo: campo('resumo').value,
        agentes_citados: campo('agentes_citados').value,
        classificacao_id: campo('classificacao_id').value,
        destino_id: form.querySelector('input[name="destino_id"]:checked').value,
        recebido_por: campo('recebido_por').value,
        forma_recebimento_id: campo('forma_recebimento_id').value,
        data_recebimento: campo('data_recebimento').value,
        prazo_dias: campo('prazo_dias').value,
        prazo_tipo: campo('prazo_tipo').value,
        data_limite: campo('data_limite').value,
        urgente: campo('urgente').checked,
        sigiloso: campo('sigiloso').checked,
        observacoes: campo('observacoes').value
      };
      if (edicao) dados.id = o.id;

      salvando = true;
      raiz.querySelector('#botao-salvar').disabled = true;
      try {
        const r = await U.comCarregando(function () { return API.salvarOficio(dados); });
        U.avisar(edicao ? 'Alterações salvas.' : 'Ofício cadastrado com sucesso.', 'sucesso');
        location.hash = '#oficio/' + r.id;
      } catch (erro) {
        salvando = false;
        raiz.querySelector('#botao-salvar').disabled = false;
      }
    });
  }

  // ===================== PÁGINAS =====================
  function montar(conteudo, o, cad, usuario, edicao) {
    conteudo.innerHTML = '<div class="pg-form"></div>';
    const raiz = conteudo.firstElementChild;
    raiz.innerHTML =
      '<header class="pagina-topo"><div>' +
        '<a href="' + (edicao ? '#oficio/' + esc(o.id) : '#painel') + '" class="link-voltar">← ' + (edicao ? 'Voltar ao ofício' : 'Voltar ao painel') + '</a>' +
        '<h1 class="pagina-titulo">' + (edicao ? 'Editar ofício nº ' + esc(o.numero_oficio) : 'Cadastrar novo ofício') + '</h1>' +
        '<p class="texto-suave">Campos com <span class="obrig">*</span> são obrigatórios. A data final é calculada automaticamente pelo prazo.</p>' +
      '</div></header>' +
      '<div class="form-layout">' + htmlFormulario(o, cad, usuario, edicao) + htmlPrevia() + '</div>';
    ligar(raiz, o, cad, edicao);
    const primeiro = raiz.querySelector('input[name="numero_oficio"]');
    if (primeiro && !edicao) primeiro.focus();
  }

  async function paginaNovo(conteudo, ctx) {
    const cad = await U.comCarregando(function () { return App.cadastros(); });
    if (!ctx.ativa()) return;
    const novo = {
      data_recebimento: U.hojeISO(),
      prazo_tipo: 'corridos',
      recebido_por: ctx.usuario.id,
      // "Ministério Público" já vem marcado por ser a origem mais comum
      origem_id: ((cad.origens || []).find(function (x) { return /minist[eé]rio p[uú]blico/i.test(x.nome); }) || {}).id || ''
    };
    montar(conteudo, novo, cad, ctx.usuario, false);
  }

  async function paginaEditar(conteudo, ctx) {
    const id = String(ctx.parametro || '').split('/')[0];
    const r = await U.comCarregando(function () {
      return Promise.all([API.obterOficio(id), App.cadastros()]);
    });
    if (!ctx.ativa()) return;
    const o = r[0].oficio;
    const u = ctx.usuario;
    const podeGerir = u.nivel === 'admin' || u.nivel === 'corregedor';

    let bloqueio = '';
    if (o.mascarado || (!podeGerir && o.sigiloso)) bloqueio = 'Somente a Corregedoria pode editar ofícios sigilosos.';
    else if (!podeGerir && o.situacao !== 'aberto') bloqueio = 'Este ofício já foi concluído. Peça à Corregedoria para reabri-lo antes de editar.';

    if (bloqueio) {
      conteudo.innerHTML =
        '<div class="estado-vazio"><h2>Edição não permitida</h2><p>' + esc(bloqueio) + '</p>' +
        '<a class="botao secundario" href="#oficio/' + esc(o.id) + '">Voltar ao ofício</a></div>';
      return;
    }
    montar(conteudo, o, r[1], u, true);
  }
  paginaEditar.titulo = 'Editar ofício';

  App.registrarPagina('novo', paginaNovo);
  App.registrarPagina('editar', paginaEditar);
})();
