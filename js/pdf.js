/* ============================================================
   CORREGEDORIA · GCM IGUATU · CONTROLE DE OFÍCIOS
   js/pdf.js · Geração dos relatórios em PDF (e planilha CSV)
   ------------------------------------------------------------
   • Usa jsPDF + jsPDF-AutoTable, carregados SÓ quando alguém gera
     um relatório. Assim o sistema abre rápido e quem nunca imprime
     não baixa as bibliotecas.
   • Cabeçalho igual ao timbre oficial da Corregedoria: brasão da
     GCM à esquerda, nome da Corregedoria em azul (fonte serifada)
     e logo da Prefeitura de Iguatu à direita.
   • Rodapé em todas as páginas: quem gerou, quando, e "Página X de Y".
   • Modelos: lista por período · pendências e vencidos ·
     consolidado por origem e destino · ficha de um ofício.
   ============================================================ */

window.PDF = (function () {
  'use strict';

  const U = App.util;

  const LIBS = [
    'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
    'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.4/dist/jspdf.plugin.autotable.min.js'
  ];

  // Cores do timbre e das faixas de prazo (RGB)
  const AZUL_TIMBRE = [7, 64, 131];
  const AZUL_ESCURO = [11, 37, 69];
  const DOURADO = [201, 162, 39];
  const CINZA = [91, 107, 128];
  const CORES_FAIXA = {
    verde: [30, 123, 69], laranja: [179, 84, 0], vermelho: [180, 35, 24],
    vencido: [110, 17, 17], respondido: [74, 91, 115], arquivado: [74, 91, 115]
  };

  const MARGEM = 14; // mm

  // ---------- Carregamento sob demanda ----------
  let carregando = null;
  function carregarScript(src) {
    return new Promise(function (ok, falha) {
      const s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = ok;
      s.onerror = function () { falha(new Error('Não foi possível carregar o gerador de PDF. Verifique a internet.')); };
      document.head.appendChild(s);
    });
  }
  function carregarLibs() {
    if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API.autoTable) return Promise.resolve();
    if (!carregando) {
      carregando = LIBS.reduce(function (p, src) { return p.then(function () { return carregarScript(src); }); }, Promise.resolve())
        .catch(function (e) { carregando = null; throw e; });
    }
    return carregando;
  }

  // Imagens do timbre convertidas para o formato que o jsPDF aceita
  const imagens = {};
  function carregarImagem(caminho) {
    if (imagens[caminho]) return Promise.resolve(imagens[caminho]);
    return new Promise(function (ok) {
      const img = new Image();
      img.onload = function () {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const g = c.getContext('2d');
        g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0);
        imagens[caminho] = { dados: c.toDataURL('image/jpeg', 0.92), w: img.naturalWidth, h: img.naturalHeight };
        ok(imagens[caminho]);
      };
      img.onerror = function () { ok(null); }; // sem a imagem, o PDF sai só com o texto
      img.src = caminho;
    });
  }

  async function novoDocumento(paisagem) {
    await carregarLibs();
    const brasao = await carregarImagem('img/brasao.png');
    const logo = await carregarImagem('img/logo-prefeitura.png');
    const doc = new window.jspdf.jsPDF({ orientation: paisagem ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    doc.__timbre = { brasao: brasao, logo: logo };
    return doc;
  }

  // ---------- Cabeçalho (timbre) ----------
  // Retorna a altura (mm) onde o conteúdo pode começar.
  function cabecalho(doc) {
    // Marca a página como "já tem timbre" (evita desenhar duas vezes)
    doc.__paginasComTimbre = doc.__paginasComTimbre || {};
    doc.__paginasComTimbre[doc.internal.getCurrentPageInfo().pageNumber] = true;
    const L = doc.internal.pageSize.getWidth();
    const t = doc.__timbre;
    const topo = 10;
    const altBrasao = 22;

    if (t.brasao) {
      const w = altBrasao * t.brasao.w / t.brasao.h;
      doc.addImage(t.brasao.dados, 'JPEG', MARGEM, topo, w, altBrasao);
    }
    doc.setFont('times', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor.apply(doc, AZUL_TIMBRE);
    const xTexto = MARGEM + 24;
    doc.text(['Corregedoria da Guarda', 'Civil Municipal de', 'Iguatu/CE'], xTexto, topo + 7.5, { lineHeightFactor: 1.15 });

    if (t.logo) {
      const altLogo = 12;
      const w = altLogo * t.logo.w / t.logo.h;
      doc.addImage(t.logo.dados, 'JPEG', L - MARGEM - w, topo + 5, w, altLogo);
    }

    doc.setDrawColor.apply(doc, DOURADO);
    doc.setLineWidth(0.6);
    doc.line(MARGEM, topo + altBrasao + 3, L - MARGEM, topo + altBrasao + 3);
    return topo + altBrasao + 9;
  }

  function titulo(doc, y, texto, subtitulo) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor.apply(doc, AZUL_ESCURO);
    doc.text(texto, MARGEM, y);
    if (subtitulo) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, CINZA);
      const linhas = doc.splitTextToSize(subtitulo, doc.internal.pageSize.getWidth() - 2 * MARGEM);
      doc.text(linhas, MARGEM, y + 5.5);
      return y + 5.5 + linhas.length * 4 + 3;
    }
    return y + 8;
  }

  // Quadros de totais lado a lado
  function quadros(doc, y, itens) {
    const L = doc.internal.pageSize.getWidth() - 2 * MARGEM;
    const gap = 3;
    const w = (L - gap * (itens.length - 1)) / itens.length;
    itens.forEach(function (it, i) {
      const x = MARGEM + i * (w + gap);
      doc.setDrawColor(214, 222, 232);
      doc.setFillColor(248, 250, 252);
      doc.setLineWidth(0.3);
      doc.roundedRect(x, y, w, 16, 2, 2, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor.apply(doc, CINZA);
      doc.text(String(it.rotulo).toUpperCase(), x + 3, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor.apply(doc, it.cor || AZUL_ESCURO);
      doc.text(String(it.valor), x + 3, y + 13);
    });
    return y + 22;
  }

  // Rodapé em todas as páginas (aplicado no final, quando já se sabe o total)
  function rodapes(doc) {
    const total = doc.internal.getNumberOfPages();
    const L = doc.internal.pageSize.getWidth();
    const A = doc.internal.pageSize.getHeight();
    const u = App.usuario() || {};
    const quando = new Date().toLocaleString('pt-BR', { timeZone: 'America/Fortaleza', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setDrawColor(214, 222, 232);
      doc.setLineWidth(0.3);
      doc.line(MARGEM, A - 12, L - MARGEM, A - 12);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor.apply(doc, CINZA);
      doc.text('Corregedoria da GCM de Iguatu/CE · Sistema de Controle de Ofícios · Gerado por ' + (u.nome || '—') + ' em ' + quando, MARGEM, A - 7.5);
      doc.text('Página ' + i + ' de ' + total, L - MARGEM, A - 7.5, { align: 'right' });
    }
  }

  // Configuração comum das tabelas: o timbre se repete em cada página
  function tabela(doc, inicioY, opcoes) {
    const topoConteudo = 41; // abaixo do timbre nas páginas seguintes
    doc.autoTable(Object.assign({
      startY: inicioY,
      margin: { left: MARGEM, right: MARGEM, top: topoConteudo, bottom: 18 },
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, textColor: [27, 43, 65], lineColor: [225, 231, 239], lineWidth: 0.2, overflow: 'linebreak' },
      headStyles: { fillColor: AZUL_TIMBRE, textColor: 255, fontStyle: 'bold', fontSize: 7.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      // Toda página nova criada pela tabela recebe o timbre
      didDrawPage: function () {
        const pag = doc.internal.getCurrentPageInfo().pageNumber;
        if (!(doc.__paginasComTimbre || {})[pag]) cabecalho(doc);
      }
    }, opcoes));
    return doc.lastAutoTable.finalY;
  }

  // ---------- Textos auxiliares ----------
  function situacaoTexto(o) {
    if (o.situacao === 'respondido') return 'Respondido ' + U.dataBR(o.resposta_data);
    if (o.situacao === 'arquivado') return 'Arquivado ' + U.dataBR(o.resposta_data);
    const d = Number(o.dias_restantes);
    if (d < 0) return 'Vencido há ' + Math.abs(d) + (d === -1 ? ' dia' : ' dias');
    if (d === 0) return 'Vence hoje';
    if (d === 1) return 'Vence amanhã';
    return 'Em aberto · ' + d + ' dias';
  }
  function assuntoParaImpressao(o, incluirSigilo) {
    if (o.sigiloso && (!incluirSigilo || o.mascarado)) return 'Ofício sigiloso';
    return o.assunto;
  }
  function origemCurta(o) {
    return o.origem_nome + (o.orgao_nome ? ' · ' + o.orgao_nome : '');
  }
  function nomeArquivo(base) {
    return base + '_' + U.hojeISO() + '.pdf';
  }

  // Entrega o PDF: na tela grande abre a pré-visualização; no celular baixa direto.
  function entregar(doc, base, previa) {
    rodapes(doc);
    const nome = nomeArquivo(base);
    if (previa && window.innerWidth >= 900) {
      const url = doc.output('bloburl');
      previa(url, function () { doc.save(nome); });
    } else {
      doc.save(nome);
    }
  }

  function resumoTotais(lista) {
    const resp = lista.filter(function (o) { return o.situacao === 'respondido'; });
    return [
      { rotulo: 'Ofícios', valor: lista.length },
      { rotulo: 'Em aberto', valor: lista.filter(function (o) { return o.situacao === 'aberto'; }).length },
      { rotulo: 'Vencidos', valor: lista.filter(function (o) { return o.faixa === 'vencido'; }).length, cor: CORES_FAIXA.vermelho },
      { rotulo: 'Respondidos', valor: resp.length },
      { rotulo: 'No prazo', valor: resp.filter(function (o) { return o.resposta_data <= o.data_limite; }).length, cor: CORES_FAIXA.verde }
    ];
  }

  // ===================== MODELO 1 · OFÍCIOS POR PERÍODO =====================
  async function lista(oficios, filtrosTexto, incluirSigilo, previa) {
    const doc = await novoDocumento(false);
    let y = cabecalho(doc);
    y = titulo(doc, y, 'Relatório de ofícios recebidos', filtrosTexto);
    y = quadros(doc, y, resumoTotais(oficios));

    tabela(doc, y, {
      head: [['Nº', 'Origem', 'Assunto', 'Destino', 'Receb.', 'Prazo', 'Situação']],
      body: oficios.map(function (o) {
        return [o.numero_oficio, origemCurta(o), assuntoParaImpressao(o, incluirSigilo), o.destino_nome,
          U.dataBR(o.data_recebimento), U.dataBR(o.data_limite), situacaoTexto(o)];
      }),
      columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 30 }, 3: { cellWidth: 21 }, 4: { cellWidth: 19.5 }, 5: { cellWidth: 19.5 }, 6: { cellWidth: 27 } },
      didParseCell: function (d) {
        if (d.section === 'body' && d.column.index === 6) {
          const o = oficios[d.row.index];
          d.cell.styles.textColor = CORES_FAIXA[o.faixa] || [27, 43, 65];
          d.cell.styles.fontStyle = 'bold';
        }
      }
    });
    if (!oficios.length) { doc.setFontSize(10); doc.setTextColor.apply(doc, CINZA); doc.text('Nenhum ofício encontrado com estes filtros.', MARGEM, y + 14); }
    entregar(doc, 'oficios_periodo', previa);
  }

  // ===================== MODELO 2 · PENDÊNCIAS E VENCIDOS =====================
  async function pendencias(oficios, filtrosTexto, incluirSigilo, previa) {
    const doc = await novoDocumento(false);
    let y = cabecalho(doc);
    y = titulo(doc, y, 'Ofícios pendentes de resposta', filtrosTexto);
    const conta = function (f) { return oficios.filter(function (o) { return o.faixa === f; }).length; };
    y = quadros(doc, y, [
      { rotulo: 'Pendentes', valor: oficios.length },
      { rotulo: 'Vencidos', valor: conta('vencido'), cor: CORES_FAIXA.vencido },
      { rotulo: 'Até 2 dias', valor: conta('vermelho'), cor: CORES_FAIXA.vermelho },
      { rotulo: '3 a 4 dias', valor: conta('laranja'), cor: CORES_FAIXA.laranja },
      { rotulo: '5 dias ou mais', valor: conta('verde'), cor: CORES_FAIXA.verde }
    ]);

    tabela(doc, y, {
      head: [['Prazo', 'Situação', 'Nº', 'Origem', 'Assunto', 'Destino']],
      body: oficios.map(function (o) {
        return [U.dataBR(o.data_limite), situacaoTexto(o).replace('Em aberto · ', ''), o.numero_oficio, origemCurta(o),
          assuntoParaImpressao(o, incluirSigilo) + (o.urgente ? ' (URGENTE)' : ''), o.destino_nome];
      }),
      columnStyles: { 0: { cellWidth: 19.5 }, 1: { cellWidth: 25 }, 2: { cellWidth: 20 }, 3: { cellWidth: 32 }, 5: { cellWidth: 22 } },
      didParseCell: function (d) {
        if (d.section === 'body' && d.column.index === 1) {
          const o = oficios[d.row.index];
          d.cell.styles.fillColor = CORES_FAIXA[o.faixa];
          d.cell.styles.textColor = 255;
          d.cell.styles.fontStyle = 'bold';
        }
      }
    });
    if (!oficios.length) { doc.setFontSize(10); doc.setTextColor.apply(doc, CINZA); doc.text('Não há ofícios pendentes de resposta.', MARGEM, y + 14); }
    entregar(doc, 'oficios_pendentes', previa);
  }

  // ===================== MODELO 3 · CONSOLIDADO =====================
  async function consolidado(dados, filtrosTexto, previa) {
    const doc = await novoDocumento(false);
    const g = dados.geral || {};
    let y = cabecalho(doc);
    y = titulo(doc, y, 'Relatório consolidado de ofícios', filtrosTexto);
    const pctPrazo = g.respondidos ? Math.round((g.no_prazo / g.respondidos) * 100) + '%' : '—';
    y = quadros(doc, y, [
      { rotulo: 'Recebidos', valor: g.recebidos || 0 },
      { rotulo: 'Respondidos', valor: g.respondidos || 0 },
      { rotulo: 'Respostas no prazo', valor: pctPrazo, cor: CORES_FAIXA.verde },
      { rotulo: 'Em aberto', valor: g.abertos || 0 },
      { rotulo: 'Tempo médio (dias)', valor: g.tempo_medio_dias == null ? '—' : String(g.tempo_medio_dias).replace('.', ',') }
    ]);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor.apply(doc, CINZA);
    doc.text('Respondidos fora do prazo: ' + (g.fora_do_prazo || 0) + ' · Arquivados sem resposta: ' + (g.arquivados || 0) +
      ' · Vencidos hoje: ' + (g.vencidos || 0), MARGEM, y - 2);
    y += 4;

    function bloco(tituloBloco, linhas) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor.apply(doc, AZUL_ESCURO);
      doc.text(tituloBloco, MARGEM, y);
      y = tabela(doc, y + 3, {
        head: [['', 'Recebidos', 'Respondidos', 'Em aberto', 'Vencidos', 'Tempo médio (dias)']],
        body: linhas.map(function (l) {
          return [l.nome, l.recebidos, l.respondidos, l.abertos, l.vencidos, l.tempo_medio_dias == null ? '—' : String(l.tempo_medio_dias).replace('.', ',')];
        }),
        columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center' }, 4: { halign: 'center' }, 5: { halign: 'center' } },
        styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.2, textColor: [27, 43, 65], lineColor: [225, 231, 239], lineWidth: 0.2 }
      }) + 10;
    }
    bloco('Por origem', dados.por_origem || []);
    bloco('Por destino', dados.por_destino || []);

    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor.apply(doc, CINZA);
    doc.text('Tempo médio: dias entre o recebimento e o envio da resposta, considerando só os ofícios respondidos.', MARGEM, Math.min(y, doc.internal.pageSize.getHeight() - 20));
    entregar(doc, 'oficios_consolidado', previa);
  }

  // ===================== MODELO 4 · FICHA DO OFÍCIO =====================
  async function ficha(o, historico, previa) {
    const doc = await novoDocumento(false);
    let y = cabecalho(doc);
    y = titulo(doc, y, 'Ficha do ofício nº ' + o.numero_oficio, situacaoTexto(o) + ' · prazo ' + U.dataBR(o.data_limite));

    const oculto = o.mascarado ? 'Conteúdo sigiloso' : null;
    const linhas = [
      ['Nº do ofício', o.numero_oficio],
      ['Origem', o.origem_nome],
      ['Órgão / unidade', o.orgao_nome || '—'],
      ['Procedimento de origem', oculto || o.procedimento || '—'],
      ['Assunto', o.assunto],
      ['Resumo do pedido', oculto || o.resumo || '—'],
      ['Agente(s) citado(s)', oculto || o.agentes_citados || '—'],
      ['Classificação', o.classificacao_nome || '—'],
      ['Destino', o.destino_nome],
      ['Forma de recebimento', o.forma_recebimento_nome || '—'],
      ['Recebido por', o.recebido_por_nome || '—'],
      ['Data de recebimento', U.dataBR(o.data_recebimento)],
      ['Prazo concedido', o.prazo_dias == null ? 'Data final informada diretamente' : o.prazo_dias + ' dia(s) ' + (o.prazo_tipo === 'uteis' ? 'úteis' : 'corridos')],
      ['Data final para resposta', U.dataBR(o.data_limite)],
      ['Urgente / Sigiloso', (o.urgente ? 'Sim' : 'Não') + ' / ' + (o.sigiloso ? 'Sim' : 'Não')]
    ];
    if (o.situacao === 'respondido') {
      linhas.push(['Resposta', (o.resposta_numero ? 'Ofício nº ' + o.resposta_numero + ' · ' : '') + 'enviada em ' + U.dataBR(o.resposta_data) +
        (o.resposta_data > o.data_limite ? ' (fora do prazo)' : ' (no prazo)')]);
      linhas.push(['Observação da resposta', oculto || o.resposta_obs || '—']);
    } else if (o.situacao === 'arquivado') {
      linhas.push(['Arquivado em', U.dataBR(o.resposta_data)]);
      linhas.push(['Motivo', oculto || o.resposta_obs || '—']);
    }

    y = tabela(doc, y, {
      body: linhas,
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 2.4, textColor: [27, 43, 65], lineColor: [225, 231, 239], lineWidth: { bottom: 0.2 } },
      columnStyles: { 0: { cellWidth: 52, fontStyle: 'bold', textColor: CINZA } }
    }) + 8;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor.apply(doc, AZUL_ESCURO);
    doc.text('Linha do tempo', MARGEM, y);
    tabela(doc, y + 3, {
      head: [['Data e hora', 'Ação', 'Usuário', 'Detalhe']],
      body: (historico || []).map(function (h) { return [U.dataHoraBR(h.em), h.acao, h.usuario || '—', h.detalhe || '']; }),
      columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 24 }, 2: { cellWidth: 32 } }
    });
    entregar(doc, 'ficha_oficio_' + String(o.numero_oficio).replace(/[^0-9A-Za-z-]+/g, '-'), previa);
  }

  // ===================== PLANILHA (CSV) =====================
  // Separador ";" e marca BOM: o Excel e o LibreOffice em português
  // abrem direto, com acentos e colunas corretas.
  function csv(oficios, incluirSigilo) {
    const cab = ['Nº do ofício', 'Origem', 'Órgão', 'Procedimento', 'Assunto', 'Classificação', 'Destino', 'Recebido em',
      'Prazo (dias)', 'Contagem', 'Data final', 'Situação', 'Dias restantes', 'Nº da resposta', 'Data da resposta', 'Urgente', 'Sigiloso'];
    const esc = function (v) { const s = v == null ? '' : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const linhas = oficios.map(function (o) {
      const oculto = o.sigiloso && (!incluirSigilo || o.mascarado);
      return [o.numero_oficio, o.origem_nome, o.orgao_nome, oculto ? '' : o.procedimento, assuntoParaImpressao(o, incluirSigilo),
        o.classificacao_nome, o.destino_nome, U.dataBR(o.data_recebimento), o.prazo_dias, o.prazo_tipo === 'uteis' ? 'úteis' : 'corridos',
        U.dataBR(o.data_limite), situacaoTexto(o), o.situacao === 'aberto' ? o.dias_restantes : '', o.resposta_numero,
        U.dataBR(o.resposta_data), o.urgente ? 'Sim' : 'Não', o.sigiloso ? 'Sim' : 'Não'].map(esc).join(';');
    });
    const conteudo = '﻿' + [cab.join(';')].concat(linhas).join('\r\n');
    const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'oficios_' + U.hojeISO() + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }

  return { lista: lista, pendencias: pendencias, consolidado: consolidado, ficha: ficha, csv: csv, carregarLibs: carregarLibs };
})();
