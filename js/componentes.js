/* ============================================================
   CORREGEDORIA · GCM IGUATU · CONTROLE DE OFÍCIOS
   js/componentes.js · Peças reutilizadas por várias páginas
   ------------------------------------------------------------
   • seloPrazo / htmlCard  → o card colorido do ofício (Painel, Arquivo)
   • faixaLocal            → calcula a cor no formulário, antes de salvar
   • janela()              → caixa de diálogo genérica (confirmar, motivo,
                             registrar resposta), sem depender de bibliotecas
   ============================================================ */

window.Comp = (function () {
  'use strict';

  const U = App.util;
  const esc = U.esc;

  // ---------- Texto do selo de prazo ----------
  function seloPrazo(o) {
    if (o.situacao === 'respondido') return 'Respondido ' + U.dataCurtaBR(o.resposta_data);
    if (o.situacao === 'arquivado') return 'Arquivado ' + U.dataCurtaBR(o.resposta_data);
    const d = Number(o.dias_restantes);
    if (d < 0) return 'Vencido há ' + Math.abs(d) + (d === -1 ? ' dia' : ' dias');
    if (d === 0) return 'Vence hoje';
    if (d === 1) return 'Vence amanhã';
    return d + ' dias';
  }

  // Mesma regra do banco, usada só na pré-visualização do formulário.
  function diasEntre(isoA, isoB) {
    const a = isoA.split('-').map(Number), b = isoB.split('-').map(Number);
    return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86400000);
  }
  function faixaLocal(dataLimite) {
    if (!dataLimite) return { faixa: 'verde', dias: null };
    const dias = diasEntre(U.hojeISO(), dataLimite);
    let faixa = 'verde';
    if (dias < 0) faixa = 'vencido';
    else if (dias <= 2) faixa = 'vermelho';
    else if (dias <= 4) faixa = 'laranja';
    return { faixa: faixa, dias: dias };
  }

  function selos(o) {
    return (o.urgente ? '<span class="selo selo-urgente">Urgente</span>' : '') +
      (o.sigiloso ? '<span class="selo selo-sigilo">' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Sigiloso</span>' : '');
  }

  // Resultado da resposta em relação ao prazo (usado no Arquivo e no detalhe)
  function resultadoPrazo(o) {
    if (o.situacao !== 'respondido' || !o.resposta_data) return '';
    const atraso = diasEntre(o.data_limite, o.resposta_data);
    if (atraso <= 0) return '<span class="selo selo-noprazo">No prazo</span>';
    return '<span class="selo selo-atraso">' + atraso + (atraso === 1 ? ' dia' : ' dias') + ' de atraso</span>';
  }

  // ---------- Card do ofício ----------
  // opcoes.modo: 'painel' (padrão) ou 'arquivo'
  function htmlCard(o, opcoes) {
    const modo = (opcoes && opcoes.modo) || 'painel';
    const aberto = o.situacao === 'aberto';
    const origem = o.origem_nome + (o.orgao_nome ? ' · ' + o.orgao_nome : '');
    const link = '#oficio/' + esc(o.id);

    let meta =
      '<span><strong>Origem:</strong> ' + esc(origem) + '</span>' +
      '<span><strong>Recebido:</strong> ' + esc(U.dataBR(o.data_recebimento)) +
        (o.recebido_por_nome ? ' por ' + esc(o.recebido_por_nome) : '') + '</span>';
    if (modo === 'arquivo' && o.situacao === 'respondido') {
      meta += '<span><strong>Resposta:</strong> ' + (o.resposta_numero ? 'nº ' + esc(o.resposta_numero) + ' · ' : '') +
        esc(U.dataBR(o.resposta_data)) + '</span>';
    }

    return (
      '<article class="card-oficio t-' + esc(o.faixa) + '">' +
        '<div class="card-prazo">' +
          '<span class="pilula p-' + esc(o.faixa) + '">' + esc(seloPrazo(o)) + '</span>' +
          '<span class="card-prazo-data">prazo ' + esc(U.dataBR(o.data_limite)) + '</span>' +
        '</div>' +
        '<div class="card-corpo">' +
          '<div class="card-linha-topo">' +
            '<span class="card-numero">Ofício nº ' + esc(o.numero_oficio) + '</span>' +
            (o.procedimento ? '<span class="card-proc">' + esc(o.procedimento) + '</span>' : '') +
            selos(o) + (modo === 'arquivo' ? resultadoPrazo(o) : '') +
          '</div>' +
          '<a class="card-assunto" href="' + link + '">' + esc(o.assunto) + '</a>' +
          '<div class="card-meta">' + meta + '</div>' +
        '</div>' +
        '<div class="card-destino">' +
          '<span class="card-destino-rotulo">Destino</span>' +
          '<span class="etiqueta-destino">' + esc(o.destino_nome) + '</span>' +
        '</div>' +
        '<div class="card-acoes">' +
          '<a class="botao secundario" href="' + link + '">Abrir</a>' +
          (aberto && !o.mascarado ? '<a class="botao azul" href="' + link + '/responder">Registrar resposta</a>' : '') +
        '</div>' +
      '</article>'
    );
  }

  // ---------- Janela genérica ----------
  // Abre um <dialog> com o HTML informado. Retorna uma Promise que resolve
  // com os valores do formulário (objeto) ao confirmar, ou null ao cancelar.
  //   opcoes: { titulo, texto, corpo (HTML de campos), botaoOk, perigo,
  //             validar(valores) → mensagem de erro ou '' }
  function janela(opcoes) {
    return new Promise(function (resolver) {
      const d = document.createElement('dialog');
      d.className = 'janela';
      d.setAttribute('aria-labelledby', 'janela-dinamica-titulo');
      d.innerHTML =
        '<form method="dialog" class="janela-corpo" novalidate>' +
          '<h2 class="janela-titulo" id="janela-dinamica-titulo">' + esc(opcoes.titulo) + '</h2>' +
          (opcoes.texto ? '<p class="texto-suave">' + esc(opcoes.texto) + '</p>' : '') +
          (opcoes.corpo || '') +
          '<p class="janela-erro" role="alert"></p>' +
          '<div class="janela-botoes">' +
            '<button type="button" class="botao secundario" data-cancelar>Cancelar</button>' +
            '<button type="submit" class="botao ' + (opcoes.perigo ? 'perigo-cheio' : 'primario') + '">' +
              esc(opcoes.botaoOk || 'Confirmar') + '</button>' +
          '</div>' +
        '</form>';
      document.body.appendChild(d);

      const form = d.querySelector('form');
      let resultado = null;

      function valores() {
        const v = {};
        form.querySelectorAll('[name]').forEach(function (campo) {
          if (campo.type === 'radio') { if (campo.checked) v[campo.name] = campo.value; }
          else if (campo.type === 'checkbox') v[campo.name] = campo.checked;
          else v[campo.name] = campo.value.trim();
        });
        return v;
      }

      form.addEventListener('submit', function (e) {
        e.preventDefault();
        const v = valores();
        const erro = opcoes.validar ? opcoes.validar(v) : '';
        if (erro) { form.querySelector('.janela-erro').textContent = erro; return; }
        resultado = v;
        d.close();
      });
      d.querySelector('[data-cancelar]').addEventListener('click', function () { d.close(); });
      d.addEventListener('close', function () { d.remove(); resolver(resultado); });

      if (opcoes.aoAbrir) opcoes.aoAbrir(form);
      d.showModal();
      const primeiro = form.querySelector('input:not([type=radio]):not([type=checkbox]), textarea, select');
      if (primeiro) primeiro.focus();
    });
  }

  function confirmar(titulo, texto, botaoOk, perigo) {
    return janela({ titulo: titulo, texto: texto, botaoOk: botaoOk, perigo: perigo })
      .then(function (r) { return r !== null; });
  }

  return {
    seloPrazo: seloPrazo,
    faixaLocal: faixaLocal,
    diasEntre: diasEntre,
    selos: selos,
    resultadoPrazo: resultadoPrazo,
    htmlCard: htmlCard,
    janela: janela,
    confirmar: confirmar
  };
})();
