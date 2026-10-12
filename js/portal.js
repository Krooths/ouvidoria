// Ouvidoria Municipal · portal do cidadão
(function () {
  'use strict';
  var O = window.OUV, $ = O.$, esc = O.esc, fmtD = O.fmtD, fmtDT = O.fmtDT, secOf = O.secOf, toast = O.toast, DAY = O.DAY;
  var sb = O.client();
  O.fillConfig();
  if (!sb) {
    var w = $('cfgWarn'); if (w) w.hidden = false;
  }

  /* ---------- Navegação ---------- */
  var screens = { home: 's-home', relato: 's-relato', ident: 's-ident', rev: 's-rev', ok: 's-ok', track: 's-track' };
  function go(name) {
    Object.keys(screens).forEach(function (k) { $(screens[k]).hidden = (k !== name); });
    window.scrollTo(0, 0);
    if (name === 'ok') $('okTitle').focus();
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]'); if (b) { go(b.getAttribute('data-go')); return; }
    var o = e.target.closest('[data-open]');
    if (o) { var w = o.getAttribute('data-open'); if (w === 'legal-info') openLegal(true); else O.openModal('m-' + w); }
  });
  function openLegal(infoOnly) {
    $('confirmSend').hidden = !!infoOnly;
    $('ackLegal').closest('.ack').hidden = !!infoOnly;
    $('ackErr').hidden = true;
    $('m-legal').querySelector('.sheet-f .btn-l').textContent = infoOnly ? 'Fechar' : 'Voltar e revisar';
    O.openModal('m-legal');
  }

  /* ---------- Tipos, assuntos, unidades ---------- */
  var tl = $('typeList'), pl = $('pills');
  O.TIPOS.forEach(function (t, i) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'type-row';
    b.innerHTML = '<span style="flex:1;min-width:0"><b>' + t.id + '</b>' + (t.warn ? '<span class="tag-y">Pode ser anônima</span>' : '') + '<span class="d">' + t.d + '</span></span><svg class="arrow chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg>';
    b.addEventListener('click', function () {
      document.querySelector('input[name=tipo][value="' + t.id + '"]').checked = true;
      if (t.id === 'Denúncia') { document.querySelector('input[name=modo][value=sigilo]').checked = true; syncModo(); }
      go('relato');
    });
    tl.appendChild(b);
    var l = document.createElement('label'); l.className = 'pill';
    l.innerHTML = '<input type="radio" name="tipo" value="' + t.id + '"' + (i === 0 ? ' checked' : '') + '><span>' + t.id + '</span>';
    pl.appendChild(l);
  });
  $('assunto').innerHTML = O.ASSUNTOS.map(function (a) { return '<option>' + esc(a[0]) + '</option>'; }).join('');
  $('unidades').innerHTML = O.UNIDADES.map(function (u) { return '<option value="' + esc(u) + '"></option>'; }).join('');
  function syncSec() { $('secHelp').textContent = 'Vai para: ' + secOf($('assunto').value); }
  $('assunto').addEventListener('change', syncSec); syncSec();

  $('a11y').addEventListener('click', function () {
    var on = document.body.classList.toggle('big'); this.setAttribute('aria-pressed', on ? 'true' : 'false'); O.lsSet('ouv-big', on);
  });
  if (O.lsGet('ouv-big', false)) { document.body.classList.add('big'); $('a11y').setAttribute('aria-pressed', 'true'); }

  /* ---------- Etapa 1: relato e arquivos ---------- */
  var desc = $('descricao'), files = [];
  desc.addEventListener('input', function () {
    $('descCount').textContent = desc.value.length.toLocaleString('pt-BR') + ' / 2.000';
    if (desc.value.trim().length >= 20) { desc.removeAttribute('aria-invalid'); $('descErr').hidden = true; }
  });
  $('gpsBtn').addEventListener('click', function () {
    var m = $('gpsMsg'); m.hidden = false; m.textContent = 'Buscando sua localização…';
    function fail() { m.textContent = 'Não foi possível acessar a localização. Confira a permissão do navegador ou digite o endereço abaixo.'; }
    try {
      if (!navigator.geolocation) return fail();
      navigator.geolocation.getCurrentPosition(function (p) {
        $('endereco').value = 'Localização GPS: ' + p.coords.latitude.toFixed(5) + ', ' + p.coords.longitude.toFixed(5);
        m.textContent = 'Localização registrada. Se quiser, acrescente um ponto de referência.';
      }, fail, { timeout: 10000, enableHighAccuracy: true });
    } catch (e) { fail(); }
  });
  var EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', pdf: 'application/pdf' };
  function classify(f) {
    var ext = ((f.name || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
    var t = (f.type || '').toLowerCase();
    var ct = EXT[ext] || t;
    if (t === 'audio/webm') ct = 'audio/webm';
    if (/^image\/(jpeg|png|webp|gif)$/.test(ct)) return { kind: 'imagem', ct: ct };
    if (/^video\/(mp4|webm|quicktime)$/.test(ct)) return { kind: 'video', ct: ct };
    if (/^audio\//.test(ct) && ['audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm'].indexOf(ct) >= 0) return { kind: 'audio', ct: ct };
    if (ct === 'application/pdf') return { kind: 'pdf', ct: ct };
    if (/^image\/hei[cf]$/.test(t) || /\.hei[cf]$/.test(f.name || '')) return { err: 'fotos HEIC não são aceitas. No iPhone, escolha a foto pela galeria (ela é convertida para JPG) ou ative Ajustes › Câmera › Formatos › Mais compatível.' };
    return { err: 'formato não aceito. Envie foto (JPG, PNG), vídeo (MP4, MOV), áudio (MP3, M4A, OGG, OPUS, WAV) ou PDF.' };
  }
  $('anexo').addEventListener('change', function () {
    var err = $('fileErr'); err.hidden = true; var msgs = [];
    Array.prototype.forEach.call(this.files, function (f) {
      if (files.length >= 5) { msgs.push('Você pode anexar até 5 arquivos.'); return; }
      if (f.size > 20 * 1024 * 1024) { msgs.push('"' + f.name + '" tem mais de 20 MB.'); return; }
      var c = classify(f); if (c.err) { msgs.push('"' + f.name + '": ' + c.err); return; }
      files.push({ file: f, name: f.name, kind: c.kind, ct: c.ct, url: URL.createObjectURL(f) });
    });
    if (msgs.length) { err.textContent = msgs.join(' '); err.hidden = false; }
    this.value = ''; renderThumbs();
  });
  function renderThumbs() {
    var box = $('thumbs'); box.innerHTML = '';
    files.forEach(function (f, i) {
      var d = document.createElement('div'); d.className = 'thumb';
      d.innerHTML = (f.kind === 'imagem' ? '<img alt="' + esc(f.name) + '" src="' + f.url + '">' : '<svg class="i" style="color:var(--teal)"><use href="#' + O.KIND_IC[f.kind] + '"/></svg><span>' + (f.kind === 'audio' ? 'Áudio' : f.kind === 'video' ? 'Vídeo' : 'PDF') + '</span><span>' + esc(f.name) + '</span>') +
        '<button type="button" class="rm" aria-label="Remover ' + esc(f.name) + '"><svg class="i"><use href="#i-x"/></svg></button>';
      d.querySelector('.rm').addEventListener('click', function () { try { URL.revokeObjectURL(f.url); } catch (e) {} files.splice(i, 1); renderThumbs(); });
      box.appendChild(d);
    });
  }
  $('s-relato').addEventListener('submit', function (e) {
    e.preventDefault();
    if (desc.value.trim().length < 20) { desc.setAttribute('aria-invalid', 'true'); $('descErr').hidden = false; desc.focus(); return; }
    go('ident');
  });

  /* ---------- Etapa 2: identificação ---------- */
  function modo() { return document.querySelector('input[name=modo]:checked').value; }
  function syncModo() { var a = modo() === 'anonima'; $('dados').hidden = a; $('anonNote').hidden = !a; }
  Array.prototype.forEach.call(document.querySelectorAll('input[name=modo]'), function (r) { r.addEventListener('change', syncModo); });
  $('whats').addEventListener('input', function () {
    var d = this.value.replace(/\D/g, '').slice(0, 11), o = '';
    if (d.length > 0) o = '(' + d.slice(0, 2); if (d.length >= 3) o += ') ' + d.slice(2, 7); if (d.length >= 8) o += '-' + d.slice(7);
    this.value = o;
  });
  $('s-ident').addEventListener('submit', function (e) {
    e.preventDefault();
    if (modo() !== 'anonima') {
      var n = $('nome'), w = $('whats');
      var nOk = n.value.trim().length >= 3, wOk = w.value.replace(/\D/g, '').length === 11;
      n.toggleAttribute('aria-invalid', !nOk); $('nomeErr').hidden = nOk;
      w.toggleAttribute('aria-invalid', !wOk); $('whatsErr').hidden = wOk;
      if (!nOk) { n.focus(); return; } if (!wOk) { w.focus(); return; }
    }
    buildReview(); go('rev');
  });

  /* ---------- Etapa 3: revisão e envio ---------- */
  function tipo() { return document.querySelector('input[name=tipo]:checked').value; }
  function localTxt() { return [$('unidade').value.trim(), $('endereco').value.trim(), $('bairro').value.trim()].filter(Boolean).join(' · '); }
  function buildReview() {
    var m = modo(), labels = { identificada: 'Identificada', sigilo: 'Com sigilo', anonima: 'Anônima' };
    var av = []; if ($('avWhats').checked) av.push('WhatsApp'); if ($('avEmail').checked) av.push('e-mail');
    var idv = labels[m] + (m === 'anonima' ? '' : '\n' + $('nome').value.trim() + ' · ' + $('whats').value + (av.length ? '\nAvisos por ' + av.join(' e ') : ''));
    var rows = [
      ['Tipo e assunto', tipo() + ' · ' + $('assunto').value + '\nSecretaria: ' + secOf($('assunto').value), 'relato'],
      ['Relato', desc.value.trim(), 'relato'],
      ['Local', localTxt() || 'Não informado', 'relato'],
      ['Anexos', files.length ? files.map(function (f) { return f.name; }).join('\n') : 'Nenhum', 'relato'],
      ['Identificação', idv, 'ident']
    ];
    $('revList').innerHTML = rows.map(function (r) { return '<div class="sum"><div><span class="k">' + r[0] + '</span><span class="v">' + esc(r[1]) + '</span></div><button type="button" data-go="' + r[2] + '">Alterar</button></div>'; }).join('');
    $('sendErr').hidden = true;
  }
  $('s-rev').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!$('ciencia').checked) { $('cienciaErr').hidden = false; $('ciencia').focus(); return; }
    $('cienciaErr').hidden = true; $('ackLegal').checked = false; openLegal(false);
  });
  $('confirmSend').addEventListener('click', function () {
    if (!$('ackLegal').checked) { $('ackErr').hidden = false; $('ackLegal').focus(); return; }
    O.closeModal($('m-legal')); send();
  });

  function setSendLabel(t) { $('sendBtn').innerHTML = '<svg class="i" style="width:20px;height:20px"><use href="#i-send"/></svg>' + esc(t); }
  function safeName(n) { return (n || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9._-]+/g, '-').slice(-80); }
  function uuid() { if (crypto.randomUUID) return crypto.randomUUID(); var b = new Uint8Array(16); crypto.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128; var h = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join(''); return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20); }
  var sending = false;
  function send() {
    if (sending) return;
    var errBox = $('sendErr');
    if (!sb) { errBox.hidden = false; errBox.textContent = 'O portal ainda não está ligado ao banco de dados. Configure o arquivo config.js.'; return; }
    sending = true; var btn = $('sendBtn'); btn.disabled = true; setSendLabel('Enviando…');
    var m = modo(), lote = uuid(), midias = [], warn = [], chain = Promise.resolve();
    files.forEach(function (f, i) {
      chain = chain.then(function () {
        setSendLabel('Enviando arquivo ' + (i + 1) + ' de ' + files.length + '…');
        var path = 'envios/' + lote + '/' + (i + 1) + '-' + safeName(f.name);
        return sb.storage.from('midias').upload(path, f.file, { contentType: f.ct, upsert: false }).then(function (r) {
          if (r.error) { warn.push('"' + f.name + '" não foi anexado (' + (/size|large/i.test(r.error.message) ? 'arquivo grande demais' : /mime|type/i.test(r.error.message) ? 'formato não aceito' : 'falha no envio') + ').'); return; }
          midias.push({ path: path, kind: f.kind, nome: f.name, contentType: f.ct, bytes: f.file.size });
        });
      });
    });
    chain.then(function () {
      setSendLabel('Registrando…');
      var p = {
        tipo: tipo(), assunto: $('assunto').value, unidade: $('unidade').value.trim(), endereco: $('endereco').value.trim(), bairro: $('bairro').value.trim(),
        descricao: desc.value.trim(), modo: m, midias: midias,
        ciencia: { avisoLegal: true, privacidade: true, versao: '2026-10' }
      };
      if (m !== 'anonima') {
        p.nome = $('nome').value.trim(); p.whats = $('whats').value; p.email = $('email').value.trim();
        p.avisos = []; if ($('avWhats').checked) p.avisos.push('whatsapp'); if ($('avEmail').checked) p.avisos.push('email');
      }
      return sb.rpc('registrar_manifestacao', { p: p });
    }).then(function (res) {
      if (res.error) throw res.error;
      var d = res.data, now = new Date(d.criada || Date.now()), prazo = new Date(d.prazo);
      var mine = O.lsGet('ouv-minhas', []);
      mine.unshift({ protocolo: d.protocolo, codigo: d.codigo, tipo: tipo(), assunto: $('assunto').value, criada: now.toISOString() });
      O.lsSet('ouv-minhas', mine.slice(0, 20)); renderMine();
      $('okNum').textContent = d.protocolo; $('okCode').textContent = d.codigo;
      $('okTipo').textContent = tipo() + ' · ' + $('assunto').value; $('okSec').textContent = d.secretaria || secOf($('assunto').value);
      $('okData').textContent = fmtDT(now); $('okPrazo').textContent = fmtD(prazo);
      var anon = m === 'anonima';
      $('okSub').textContent = anon ? 'Anote o protocolo e o código abaixo. São o único jeito de acompanhar uma manifestação anônima.' : 'Obrigado por ajudar a melhorar a cidade. Anote o protocolo e o código de acesso.';
      $('okStep3').textContent = anon ? 'A resposta fica disponível aqui, com o protocolo e o código.' : 'Você recebe a resposta e pode avaliar o atendimento.';
      $('okWarn').hidden = !warn.length;
      $('okWarn').innerHTML = warn.length ? '<svg class="i"><use href="#i-alert"/></svg><div>' + warn.map(esc).join('<br>') + '</div>' : '';
      $('waBtn').href = 'https://wa.me/?text=' + encodeURIComponent('Ouvidoria Municipal\nProtocolo: ' + d.protocolo + '\nCódigo de acesso: ' + d.codigo);
      $('okTrack').onclick = function () { track(d.protocolo, d.codigo); };
      resetForm(); go('ok');
    }).catch(function (err) {
      console.error(err);
      errBox.hidden = false;
      errBox.textContent = (err && err.message && /ciência|nome|inválid/i.test(err.message)) ? err.message : 'Não foi possível registrar a manifestação agora. Seus dados continuam aqui; tente enviar de novo em alguns instantes.';
    }).then(function () { sending = false; btn.disabled = false; setSendLabel('Enviar manifestação'); });
  }
  function resetForm() {
    $('s-relato').reset(); $('s-ident').reset(); $('s-rev').reset();
    files.forEach(function (f) { try { URL.revokeObjectURL(f.url); } catch (e) {} }); files = []; renderThumbs();
    $('descCount').textContent = '0 / 2.000'; $('gpsMsg').hidden = true; syncModo(); syncSec();
    document.querySelector('input[name=tipo]').checked = true;
  }
  function copyText(t, el) {
    function fallback() { var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Texto selecionado. Use Copiar do seu celular.'); }
    try { navigator.clipboard.writeText(t).then(function () { toast('Protocolo e código copiados'); }, fallback); } catch (e) { fallback(); }
  }
  $('copyBtn').addEventListener('click', function () { copyText('Protocolo: ' + $('okNum').textContent + ' · Código: ' + $('okCode').textContent, $('okNum')); });

  /* ---------- Acompanhamento ---------- */
  var current = null;
  function stBadge(r) {
    var late = O.isLate(r);
    var c = late ? 'st-late' : ({ Nova: 'st-novo', 'Em análise': 'st-and', Encaminhada: 'st-and', Respondida: 'st-ok', Arquivada: 'st-arq' }[r.status] || 'st-novo');
    return '<span class="st ' + c + '">' + esc(late ? 'Fora do prazo' : r.status === 'Nova' ? 'Recebida' : r.status) + '</span>';
  }
  function renderMine() {
    var mine = O.lsGet('ouv-minhas', []);
    $('mineBox').hidden = !mine.length;
    $('mineList').innerHTML = mine.slice(0, 5).map(function (r, i) { return '<button type="button" class="mine" data-i="' + i + '"><div style="flex:1;min-width:0"><span class="mono">' + esc(r.protocolo) + '</span><small>' + esc(r.tipo + ' · ' + r.assunto) + '</small></div><svg class="arrow" width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15M13 5l7 7-7 7"/></svg></button>'; }).join('');
  }
  renderMine();
  $('mineList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-i]'); if (!b) return;
    var r = O.lsGet('ouv-minhas', [])[+b.getAttribute('data-i')]; if (r) track(r.protocolo, r.codigo);
  });
  function track(prot, code, silent) {
    var err = $('trackErr');
    if (!sb) { err.hidden = false; err.textContent = 'O portal ainda não está ligado ao banco de dados.'; return Promise.resolve(false); }
    return sb.rpc('consultar_manifestacao', { p_protocolo: prot, p_codigo: code }).then(function (res) {
      if (res.error || !res.data) {
        err.hidden = false; err.textContent = res.error ? 'Não foi possível consultar agora. Tente de novo.' : 'Protocolo ou código não conferem. Confira os dois e tente de novo.';
        if (!silent) { go('home'); $('trackInput').focus(); }
        return false;
      }
      err.hidden = true; showTrack(res.data, code, silent); return true;
    });
  }
  function showTrack(r, code, silent) {
    current = { r: r, code: code };
    $('trNum').innerHTML = esc(r.protocolo) + (r.exemplo ? '<span class="tag-ex" style="color:var(--head-faint);border-color:var(--navy-line)">exemplo</span>' : '');
    $('trTipo').textContent = r.tipo + ' · ' + r.assunto;
    $('trLocal').textContent = [r.unidade, r.endereco, r.bairro].filter(Boolean).join(' · ') || 'Local não informado';
    var fim = O.STATUS_FIM.indexOf(r.status) >= 0;
    $('trStatus').textContent = r.status === 'Nova' ? 'Recebida' : fim ? r.status : 'Em andamento';
    $('trStatus').classList.toggle('done-st', fim);
    var criada = new Date(r.criada), prazo = new Date(r.prazo);
    var dia = Math.min(30, Math.max(1, Math.floor((Date.now() - criada) / DAY) + 1));
    $('trPrazo').textContent = 'até ' + fmtD(prazo);
    $('trMeter').style.width = (fim ? 100 : dia / 30 * 100).toFixed(1) + '%';
    $('trMeterBox').setAttribute('aria-label', fim ? 'Concluída' : 'Dia ' + dia + ' de 30 do prazo');
    $('trDia').textContent = fim ? 'Concluída' : 'Dia ' + dia + ' de 30 · ' + (O.isLate(r) ? 'prazo vencido' : 'dentro do prazo');
    var ev = (r.eventos || []).filter(function (e) { return e.por !== 'interno'; }), html = '';
    ev.forEach(function (e, i) {
      var last = i === ev.length - 1, cur = last && !fim && ev.length > 1;
      html += '<li class="' + (cur ? 'now' : 'done-s') + '"><div class="rail"><span class="dot">' + (cur ? '' : '<svg class="i"><use href="#i-check"/></svg>') + '</span>' + (last && fim ? '' : '<span class="line"></span>') + '</div><div class="body"><b>' + esc(e.t) + '</b><small>' + fmtDT(new Date(e.d)) + '</small>' + (e.msg ? '<div class="msg">' + esc(e.msg) + '</div>' : '') + '</div></li>';
    });
    if (!fim) html += '<li class="todo"><div class="rail"><span class="dot"></span></div><div class="body"><b>Resposta final</b><small>Prevista até ' + fmtD(prazo) + '</small></div></li>';
    $('trTl').innerHTML = html;
    $('trActions').hidden = fim;
    if (!silent) go('track');
  }
  $('compForm').addEventListener('submit', function (e) {
    e.preventDefault(); if (!current) return;
    var t = $('compText').value.trim(); if (t.length < 3) { $('compText').focus(); return; }
    var r = current.r;
    if (r.exemplo) { r.eventos = r.eventos.concat([{ t: 'Complemento enviado pelo cidadão', d: new Date().toISOString(), msg: t, por: 'cidadao' }]); $('compText').value = ''; toast('Complemento enviado'); showTrack(r, current.code, true); return; }
    sb.rpc('complementar_manifestacao', { p_protocolo: r.protocolo, p_codigo: current.code, p_texto: t }).then(function (res) {
      if (res.error || res.data !== true) { toast('Não foi possível enviar o complemento.'); return; }
      $('compText').value = ''; toast('Complemento enviado'); track(r.protocolo, current.code, true);
    });
  });
  $('trackForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('trackInput').value.trim().replace(/[^\d.]/g, ''), c = $('trackCode').value.trim().toUpperCase(), err = $('trackErr');
    if (/^\d{10}$/.test(v)) v = v.slice(0, 4) + '.' + v.slice(4);
    if (!v || !c) { err.hidden = false; err.textContent = 'Digite o protocolo e o código de acesso.'; (v ? $('trackCode') : $('trackInput')).focus(); return; }
    if (/^[0-9A-F]{8}$/.test(c)) c = c.slice(0, 4) + '-' + c.slice(4);
    track(v, c);
  });

  syncModo();
})();
