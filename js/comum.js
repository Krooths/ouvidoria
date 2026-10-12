// Ouvidoria Municipal · funções compartilhadas pelo portal e pelo painel
(function () {
  'use strict';
  var CFG = window.OUVIDORIA_CONFIG || {};

  var TIPOS = [
    { id: 'Reclamação', ic: 'i-speak', d: 'Um serviço não funcionou como deveria' },
    { id: 'Denúncia', ic: 'i-shield', d: 'Irregularidade ou conduta de servidor', warn: true },
    { id: 'Solicitação', ic: 'i-clip', d: 'Pedir um serviço: poda, tapa-buraco, iluminação' },
    { id: 'Sugestão', ic: 'i-bulb', d: 'Uma ideia para melhorar a cidade' },
    { id: 'Elogio', ic: 'i-heart', d: 'Reconhecer um bom atendimento' }
  ];
  // Precisa bater com a função secretaria_do_assunto() do schema.sql
  var ASSUNTOS = [
    ['Iluminação pública', 'Obras e Serviços Públicos'],
    ['Buraco ou pavimentação', 'Obras e Serviços Públicos'],
    ['Coleta de lixo e limpeza', 'Meio Ambiente e Limpeza Urbana'],
    ['Saúde · unidade ou atendimento', 'Saúde'],
    ['Educação · escola ou creche', 'Educação'],
    ['Transporte coletivo', 'Trânsito e Transporte'],
    ['Assistência social', 'Assistência Social'],
    ['Atendimento de servidor', 'Administração'],
    ['Outro assunto', 'Ouvidoria (triagem)']
  ];
  var SECS = [];
  ASSUNTOS.forEach(function (a) { if (SECS.indexOf(a[1]) < 0) SECS.push(a[1]); });
  // Categorias do cadastro de locais (tabela catalogo no Supabase)
  var CATS = {
    saude: 'Unidades de saúde', educacao: 'Escolas e CEINFs', onibus: 'Linhas de ônibus e terminais', bairro: 'Bairros', outros: 'Outros locais e serviços'
  };
  // Qual lista sugerir para cada assunto
  var CAT_DO_ASSUNTO = {
    'Saúde · unidade ou atendimento': 'saude', 'Educação · escola ou creche': 'educacao', 'Transporte coletivo': 'onibus'
  };
  var STATUS_FIM = ['Respondida', 'Arquivada'];
  var DAY = 864e5;
  var KIND_IC = { imagem: 'i-cam', video: 'i-video', audio: 'i-mic', pdf: 'i-doc' };

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmtD(d) { return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
  function fmtDT(d) { return fmtD(d) + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function secOf(assunto) { for (var i = 0; i < ASSUNTOS.length; i++) if (ASSUNTOS[i][0] === assunto) return ASSUNTOS[i][1]; return 'Ouvidoria (triagem)'; }
  function isLate(r) { return STATUS_FIM.indexOf(r.status) < 0 && new Date(r.prazo).getTime() < Date.now(); }
  function toast(msg) { var t = $('toast'); if (!t) return; t.textContent = msg; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 3200); }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  function client() {
    if (!window.supabase || !CFG.supabaseUrl || /SEU-PROJETO/.test(CFG.supabaseUrl)) return null;
    return window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  }

  // Preenche os textos da prefeitura definidos em config.js
  function fillConfig() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-cfg]'), function (el) {
      var v = CFG[el.getAttribute('data-cfg')]; if (v) el.textContent = v;
    });
  }

  // Diálogos (aviso legal, privacidade, equipe)
  var lastFocus = null;
  function openModal(id) {
    var m = $(id); if (!m) return; lastFocus = document.activeElement;
    m.hidden = false; document.body.classList.add('modal-open');
    var f = m.querySelector('.x'); if (f) f.focus();
  }
  function closeModal(m) {
    if (!m || m.hidden) return; m.hidden = true; document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  document.addEventListener('click', function (e) {
    var c = e.target.closest('[data-close]'); if (c) closeModal(c.closest('.modal'));
    var s = e.target.closest('[data-show]');
    if (s) { var i = $(s.getAttribute('data-show')); var sh = i.type === 'password'; i.type = sh ? 'text' : 'password'; s.textContent = sh ? 'Ocultar' : 'Mostrar'; }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = document.querySelector('.modal:not([hidden])'); if (open) closeModal(open);
  });

  window.OUV = {
    CFG: CFG, TIPOS: TIPOS, ASSUNTOS: ASSUNTOS, SECS: SECS, CATS: CATS, CAT_DO_ASSUNTO: CAT_DO_ASSUNTO, STATUS_FIM: STATUS_FIM, DAY: DAY, KIND_IC: KIND_IC,
    $: $, esc: esc, fmtD: fmtD, fmtDT: fmtDT, secOf: secOf, isLate: isLate, toast: toast, lsGet: lsGet, lsSet: lsSet,
    client: client, fillConfig: fillConfig, openModal: openModal, closeModal: closeModal
  };
})();
