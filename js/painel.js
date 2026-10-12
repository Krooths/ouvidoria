// Ouvidoria Municipal · painel da prefeitura
(function () {
  'use strict';
  var O = window.OUV, $ = O.$, esc = O.esc, fmtD = O.fmtD, fmtDT = O.fmtDT, secOf = O.secOf, isLate = O.isLate, toast = O.toast, DAY = O.DAY;
  var SECS = O.SECS, TIPOS = O.TIPOS, KIND_IC = O.KIND_IC;
  var PERFIS = { ouvidor: 'Ouvidor(a)', secretaria: 'Secretaria', consulta: 'Consulta' };
  var IDLE_MIN = 30;
  var sb = O.client();
  O.fillConfig();

  var me = null;            // linha da tabela equipe de quem está logado
  var equipe = [];
  var real = {};            // manifestações do banco, por protocolo
  var DEMO = null;
  var adm = { started: false, demo: O.lsGet('ouv-demo', null), dims: { recl: 'local', elog: 'local' }, tipos: [], limit: 30, open: null, timer: null };

  /* ================= Login ================= */
  function showErr(id, msg) { var e = $(id); if (!e) return; e.textContent = msg || ''; e.hidden = !msg; }
  function showLogin(which, msg) {
    $('admMain').hidden = true; $('admLogin').hidden = false;
    ['loginForm', 'signupForm', 'recoveryForm'].forEach(function (id) { $(id).hidden = id !== which + 'Form'; });
    ['who', 'teamBtn', 'logoutBtn', 'demoWrap'].forEach(function (id) { $(id).hidden = true; });
    if (which === 'login') showErr('lgErr', msg); else if (which === 'signup') showErr('suErr', msg); else showErr('rcErr', msg);
  }
  function pwdOk(p) { return p.length >= 10 && /[A-Za-zÀ-ú]/.test(p) && /\d/.test(p); }

  if (!sb) {
    showLogin('login', 'O painel ainda não está ligado ao banco de dados. Preencha o arquivo config.js com os dados do seu projeto Supabase.');
    $('lgBtn').disabled = true;
    return;
  }

  var recovering = /type=recovery/.test(location.hash);
  sb.auth.onAuthStateChange(function (event, session) {
    if (event === 'PASSWORD_RECOVERY') { recovering = true; showLogin('recovery'); return; }
    if (event === 'SIGNED_OUT') { me = null; stopPanel(); if (!recovering) showLogin('login', logoutMsg); logoutMsg = ''; return; }
    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && !recovering) loadProfile();
  });
  sb.auth.getSession().then(function (r) { if (!r.data.session && !recovering) showLogin('login'); });

  function loadProfile() {
    sb.rpc('meu_perfil').then(function (res) {
      if (res.error || !res.data) {
        logoutMsg = 'Seu e-mail não está liberado no painel ou o acesso foi desativado. Fale com o(a) Ouvidor(a).';
        sb.auth.signOut(); return;
      }
      me = res.data; showPanel();
    });
  }
  var logoutMsg = '';
  function logout(msg) { logoutMsg = msg || ''; sb.auth.signOut(); }
  $('logoutBtn').addEventListener('click', function () { logout('Você saiu do painel.'); });

  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var em = $('lgEmail').value.trim().toLowerCase(), pw = $('lgPass').value, btn = $('lgBtn');
    if (!em || !pw) { showErr('lgErr', 'Preencha e-mail e senha.'); return; }
    btn.disabled = true; btn.textContent = 'Entrando…';
    sb.auth.signInWithPassword({ email: em, password: pw }).then(function (r) {
      if (r.error) {
        showErr('lgErr', /confirm/i.test(r.error.message) ? 'Confirme seu e-mail pelo link que enviamos antes de entrar.' : /rate|many/i.test(r.error.message) ? 'Muitas tentativas. Aguarde alguns minutos.' : 'E-mail ou senha incorretos.');
        $('lgPass').value = ''; $('lgPass').focus();
      } else { showErr('lgErr', ''); $('lgPass').value = ''; }
    }).then(function () { btn.disabled = false; btn.textContent = 'Entrar'; });
  });
  $('forgotBtn').addEventListener('click', function () {
    var em = $('lgEmail').value.trim().toLowerCase();
    if (!em) { showErr('lgErr', 'Digite seu e-mail acima e toque de novo em "Esqueci minha senha".'); $('lgEmail').focus(); return; }
    sb.auth.resetPasswordForEmail(em, { redirectTo: location.origin + location.pathname }).then(function (r) {
      showErr('lgErr', '');
      toast(r.error ? 'Não foi possível enviar agora. Tente mais tarde.' : 'Se o e-mail estiver cadastrado, você receberá um link para criar nova senha.');
    });
  });
  $('toSignup').addEventListener('click', function () { showLogin('signup'); $('suEmail').value = $('lgEmail').value; $('suOk').hidden = true; });
  $('toLogin').addEventListener('click', function () { showLogin('login'); });
  $('signupForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var em = $('suEmail').value.trim().toLowerCase(), p1 = $('suPass').value, p2 = $('suPass2').value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return showErr('suErr', 'Informe um e-mail válido.');
    if (!pwdOk(p1)) return showErr('suErr', 'A senha precisa de pelo menos 10 caracteres, com letras e números.');
    if (p1 !== p2) return showErr('suErr', 'As senhas não conferem.');
    showErr('suErr', '');
    sb.auth.signUp({ email: em, password: p1, options: { emailRedirectTo: location.origin + location.pathname } }).then(function (r) {
      if (r.error) { showErr('suErr', /registered|exists/i.test(r.error.message) ? 'Este e-mail já tem senha. Volte e use "Entrar" ou "Esqueci minha senha".' : 'Não foi possível criar a senha agora. Tente de novo.'); return; }
      $('suPass').value = ''; $('suPass2').value = '';
      $('suOk').hidden = false;
      $('suOk').textContent = r.data.session ? 'Senha criada.' : 'Pronto. Enviamos um link de confirmação para ' + em + '. Abra o e-mail, confirme e depois entre aqui.';
    });
  });
  $('recoveryForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var p1 = $('rcPass').value, p2 = $('rcPass2').value;
    if (!pwdOk(p1)) return showErr('rcErr', 'A senha precisa de pelo menos 10 caracteres, com letras e números.');
    if (p1 !== p2) return showErr('rcErr', 'As senhas não conferem.');
    sb.auth.updateUser({ password: p1 }).then(function (r) {
      if (r.error) { showErr('rcErr', 'O link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".'); return; }
      recovering = false; history.replaceState(null, '', location.pathname); toast('Senha alterada.'); loadProfile();
    });
  });

  // Encerrar por inatividade
  var lastAct = Date.now();
  ['click', 'keydown', 'touchstart', 'mousemove', 'scroll'].forEach(function (ev) { document.addEventListener(ev, function () { lastAct = Date.now(); }, { passive: true, capture: true }); });
  setInterval(function () { if (me && Date.now() - lastAct > IDLE_MIN * 60e3) logout('Sessão encerrada após ' + IDLE_MIN + ' minutos sem uso. Entre de novo.'); }, 30e3);

  /* ================= Painel ================= */
  function showPanel() {
    $('admLogin').hidden = true; $('admMain').hidden = false;
    $('whoName').textContent = me.nome; $('whoRole').textContent = PERFIS[me.perfil] + (me.perfil === 'secretaria' ? ' · ' + me.secretaria : '');
    $('who').hidden = false; $('logoutBtn').hidden = false; $('teamBtn').hidden = me.perfil !== 'ouvidor'; $('demoWrap').hidden = false;
    if (!adm.started) {
      adm.started = true;
      $('fSec').innerHTML = '<option value="">Todas</option>' + SECS.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
      $('dwSec').innerHTML = SECS.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
      $('fTipo').innerHTML = TIPOS.map(function (t) { return '<button type="button" class="fchip" aria-pressed="false" data-t="' + t.id + '">' + t.id + '</button>'; }).join('');
    }
    if (me.perfil === 'secretaria') { $('fSec').value = me.secretaria; $('fSec').disabled = true; } else $('fSec').disabled = false;
    loadData();
    clearInterval(adm.timer); adm.timer = setInterval(loadData, 60e3);
  }
  function stopPanel() { clearInterval(adm.timer); real = {}; closeDrawer(); O.closeModal($('m-team')); }

  var COLS = 'id,protocolo,tipo,assunto,secretaria,unidade,endereco,bairro,descricao,modo,status,criada,prazo,midias,eventos,ciencia,sinalizada,contato:manifestacao_contato(nome,whats,email,avisos)';
  var loading = false;
  function loadData() {
    if (loading || !me) return; loading = true;
    sb.from('manifestacoes').select(COLS).order('criada', { ascending: false }).limit(2000).then(function (res) {
      loading = false;
      if (res.error) { console.error(res.error); $('admSub').textContent = 'Não foi possível carregar as manifestações. Tente "Atualizar".'; return; }
      real = {};
      res.data.forEach(function (row) {
        var c = Array.isArray(row.contato) ? row.contato[0] : row.contato;
        var r = Object.assign({}, row); delete r.contato; r._id = row.id;
        if (c) { r.nome = c.nome; r.whats = c.whats; r.email = c.email; r.avisos = c.avisos; r._contato = true; }
        real[r.protocolo] = r;
      });
      renderAdmin();
      if (adm.open && real[adm.open]) renderDrawer(real[adm.open]);
    });
  }
  $('refreshBtn').addEventListener('click', function () { loadData(); toast('Atualizado'); });

  // Dados de exemplo (gerados no navegador, nunca gravados)
  function buildDemo() {
    var seed = 20261012; function rnd() { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }
    function pick(a) { return a[Math.floor(rnd() * a.length)]; }
    var BAIRROS = ['Centro', 'Jardim das Flores', 'Vila Nova', 'Bela Vista', 'Santa Rita', 'Parque dos Ipês', 'São José', 'Morada do Sol'];
    var LOC = [['UBS Centro', 'Saúde · unidade ou atendimento', .55, 10], ['UBS Vila Nova', 'Saúde · unidade ou atendimento', .1, 12], ['Policlínica Municipal', 'Saúde · unidade ou atendimento', .25, 9],
      ['Escola Municipal Monteiro Lobato', 'Educação · escola ou creche', .6, 7], ['CEI Pequeno Príncipe', 'Educação · escola ou creche', .35, 5],
      ['Terminal Central', 'Transporte coletivo', .05, 11], ['Linha 104', 'Transporte coletivo', .08, 9], ['Praça da Matriz', 'Coleta de lixo e limpeza', .2, 6],
      ['CRAS Bela Vista', 'Assistência social', .5, 5], ['Praça de Atendimento ao Cidadão', 'Atendimento de servidor', .4, 7],
      ['', 'Iluminação pública', .03, 14], ['', 'Buraco ou pavimentação', .02, 15], ['', 'Coleta de lixo e limpeza', .08, 9]];
    var tot = 0; LOC.forEach(function (l) { tot += l[3]; });
    var TXT = { 'Iluminação pública': ['Poste apagado há mais de uma semana na rua.'], 'Buraco ou pavimentação': ['Buraco grande na pista, carros desviando pela contramão.'], 'Coleta de lixo e limpeza': ['A coleta não passou nesta semana.'],
      'Saúde · unidade ou atendimento': ['Esperei mais de quatro horas para ser atendido.', 'Equipe muito atenciosa no atendimento.'], 'Educação · escola ou creche': ['A professora acompanhou meu filho com muito cuidado.'],
      'Transporte coletivo': ['Ônibus atrasou 40 minutos no horário de pico.'], 'Assistência social': ['Fui muito bem orientada no cadastro.'], 'Atendimento de servidor': ['Atendimento rápido e educado.'] };
    var out = [], now = Date.now();
    for (var i = 0; i < 170; i++) {
      var x = rnd() * tot, L = LOC[0]; for (var j = 0; j < LOC.length; j++) { x -= LOC[j][3]; if (x <= 0) { L = LOC[j]; break; } }
      var age = Math.floor(Math.pow(rnd(), 1.3) * 100);
      var t = rnd() < L[2] ? 'Elogio' : (function () { var y = rnd(); return y < .62 ? 'Reclamação' : y < .82 ? 'Solicitação' : y < .92 ? 'Denúncia' : 'Sugestão'; })();
      var cri = new Date(now - age * DAY - Math.floor(rnd() * DAY));
      var st = age > 40 ? (rnd() < .88 ? 'Respondida' : 'Encaminhada') : age > 20 ? (rnd() < .6 ? 'Respondida' : 'Encaminhada') : age > 5 ? pick(['Em análise', 'Encaminhada', 'Respondida']) : pick(['Nova', 'Em análise']);
      if (t === 'Elogio' && age > 3) st = 'Respondida';
      var nm = rnd(), mids = nm < .35 ? [{ kind: 'imagem' }] : nm < .45 ? [{ kind: 'video' }] : nm < .52 ? [{ kind: 'audio' }] : [];
      var ev = [{ t: 'Recebida', d: cri.toISOString() }];
      if (st !== 'Nova') ev.push({ t: 'Analisada pela Ouvidoria', d: new Date(cri.getTime() + DAY).toISOString() });
      if (st === 'Encaminhada' || st === 'Respondida') ev.push({ t: 'Encaminhada à ' + secOf(L[1]), d: new Date(cri.getTime() + 2 * DAY).toISOString() });
      if (st === 'Respondida') ev.push({ t: 'Respondida', d: new Date(cri.getTime() + Math.min(age, 12) * DAY).toISOString(), msg: 'Resposta registrada pela secretaria.' });
      var md = rnd();
      out.push({ protocolo: cri.getFullYear() + '.' + String(900000 + i), exemplo: true, tipo: t, assunto: L[1], secretaria: secOf(L[1]), unidade: L[0],
        endereco: L[0] ? '' : 'Rua ' + pick(['das Acácias', 'Projetada A', 'Sete de Setembro', 'dos Ipês']) + ', ' + (10 + Math.floor(rnd() * 900)),
        bairro: pick(BAIRROS), descricao: pick(TXT[L[1]] || ['Relato de exemplo.']), modo: md < .6 ? 'identificada' : md < .85 ? 'sigilo' : 'anonima',
        nome: md < .85 ? 'Cidadão de exemplo' : undefined, criada: cri.toISOString(), prazo: new Date(cri.getTime() + 30 * DAY).toISOString(), status: st, midias: mids, eventos: ev,
        ciencia: { avisoLegal: true, privacidade: true, em: cri.toISOString() } });
    }
    return out;
  }
  function admRecords() {
    var list = Object.keys(real).map(function (k) { return real[k]; });
    var useDemo = adm.demo === null ? list.length < 20 : adm.demo;
    $('demoTgl').checked = useDemo;
    if (useDemo) { if (!DEMO) DEMO = buildDemo(); list = list.concat(DEMO); }
    if (me && me.perfil === 'secretaria') list = list.filter(function (r) { return r.secretaria === me.secretaria; });
    return { list: list, useDemo: useDemo, realCount: list.filter(function (r) { return !r.exemplo; }).length };
  }

  ['fPer', 'fSec', 'fBai', 'fSt'].forEach(function (id) { $(id).addEventListener('change', function () { adm.limit = 30; renderAdmin(); }); });
  $('fQ').addEventListener('input', function () { adm.limit = 30; renderInbox(currentFiltered); });
  $('fTipo').addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (!b) return; var t = b.getAttribute('data-t'), i = adm.tipos.indexOf(t); if (i < 0) adm.tipos.push(t); else adm.tipos.splice(i, 1); b.setAttribute('aria-pressed', i < 0 ? 'true' : 'false'); renderAdmin(); });
  $('fClear').addEventListener('click', function () { $('fPer').value = '90'; if (!(me && me.perfil === 'secretaria')) $('fSec').value = ''; $('fBai').value = ''; $('fSt').value = ''; $('fQ').value = ''; adm.tipos = []; Array.prototype.forEach.call(document.querySelectorAll('#fTipo .fchip'), function (b) { b.setAttribute('aria-pressed', 'false'); }); renderAdmin(); });
  $('demoTgl').addEventListener('change', function () { adm.demo = this.checked; O.lsSet('ouv-demo', adm.demo); renderAdmin(); });
  Array.prototype.forEach.call(document.querySelectorAll('.seg[data-dim]'), function (seg) {
    seg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; adm.dims[seg.getAttribute('data-dim')] = b.getAttribute('data-v');
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); renderAdmin(); });
  });
  $('moreBtn').addEventListener('click', function () { adm.limit += 30; renderInbox(currentFiltered); });

  var currentFiltered = [];
  function applyFilters(list, opts) {
    opts = opts || {};
    var per = +$('fPer').value, sec = $('fSec').value, bai = $('fBai').value, st = $('fSt').value, since = per ? Date.now() - per * DAY : 0;
    return list.filter(function (r) {
      if (since && new Date(r.criada).getTime() < since) return false;
      if (sec && r.secretaria !== sec) return false;
      if (bai && r.bairro !== bai) return false;
      if (!opts.ignoreTipo && adm.tipos.length && adm.tipos.indexOf(r.tipo) < 0) return false;
      if (st === 'late') { if (!isLate(r)) return false; } else if (st && r.status !== st) return false;
      return true;
    });
  }
  function localLabel(r) { return r.unidade || r.bairro || 'Local não informado'; }
  function stClass(r) { if (isLate(r)) return 'st-late'; return { Nova: 'st-novo', 'Em análise': 'st-and', Encaminhada: 'st-and', Respondida: 'st-ok', Arquivada: 'st-arq' }[r.status] || 'st-novo'; }
  function stBadge(r) { return '<span class="st ' + stClass(r) + '">' + esc(isLate(r) ? 'Fora do prazo' : r.status) + '</span>'; }
  function renderAdmin() {
    if (!me) return;
    var R = admRecords(), list = R.list;
    var bairros = {}; list.forEach(function (r) { if (r.bairro) bairros[r.bairro] = 1; });
    var curB = $('fBai').value; $('fBai').innerHTML = '<option value="">Todos</option>' + Object.keys(bairros).sort().map(function (b) { return '<option' + (b === curB ? ' selected' : '') + '>' + esc(b) + '</option>'; }).join('');
    $('admSub').textContent = R.realCount + (R.realCount === 1 ? ' manifestação real' : ' manifestações reais') + ' · atualiza a cada minuto';
    $('demoBanner').hidden = !R.useDemo;
    $('demoBannerTxt').textContent = 'Incluindo manifestações de exemplo para demonstrar os gráficos. Elas têm a etiqueta "exemplo" e não estão no banco. Desmarque "Incluir dados de exemplo" para ver só as reais.';
    var f = applyFilters(list); currentFiltered = f;
    renderKpis(f);
    var noTipo = applyFilters(list, { ignoreTipo: true });
    renderRank('chRecl', noTipo.filter(function (r) { return r.tipo === 'Reclamação'; }), adm.dims.recl, 'var(--s-recl)', 'reclamações');
    renderRank('chElog', noTipo.filter(function (r) { return r.tipo === 'Elogio'; }), adm.dims.elog, 'var(--s-elog)', 'elogios');
    renderSec(noTipo);
    renderInbox(f);
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) + '% do total' : '—'; }
  function renderKpis(f) {
    function c(fn) { return f.filter(fn).length; }
    var tot = f.length, late = c(isLate), med = c(function (r) { return r.midias && r.midias.length; });
    var nr = c(function (r) { return r.tipo === 'Reclamação'; }), ne = c(function (r) { return r.tipo === 'Elogio'; }), nd = c(function (r) { return r.tipo === 'Denúncia'; });
    var k = [['Total', tot, 'no período', ''], ['Reclamações', nr, pct(nr, tot), 'var(--s-recl)'], ['Elogios', ne, pct(ne, tot), 'var(--s-elog)'], ['Denúncias', nd, pct(nd, tot), 'var(--danger)'],
      ['Fora do prazo', late, 'mais de 30 dias sem resposta', '', late > 0], ['Com mídia', med, 'fotos, vídeos ou áudios', '']];
    $('kpis').innerHTML = k.map(function (x) { return '<div class="kpi' + (x[4] ? ' alert' : '') + '"><div class="lb">' + (x[3] ? '<i style="background:' + x[3] + '"></i>' : '') + x[0] + '</div><div class="v">' + x[1].toLocaleString('pt-BR') + '</div><div class="d">' + x[2] + '</div></div>'; }).join('');
  }
  function renderRank(id, rows, dim, color, noun) {
    var m = {}; rows.forEach(function (r) { var k = dim === 'local' ? localLabel(r) : r.assunto; m[k] = (m[k] || 0) + 1; });
    var arr = Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
    var box = $(id);
    if (!arr.length) { box.innerHTML = '<div class="empty">Nenhum registro de ' + noun + ' com estes filtros.</div>'; return; }
    var max = arr[0][1], tot = rows.length;
    box.innerHTML = arr.map(function (a) { return '<button type="button" class="hb" data-q="' + esc(a[0]) + '" data-tip="' + esc(a[0]) + '|' + a[1] + ' ' + noun + ' · ' + Math.round(a[1] / tot * 100) + '% do total"><span class="hb-l">' + esc(a[0]) + '</span><span class="hb-t"><span class="hb-f" style="width:' + (a[1] / max * 100).toFixed(1) + '%;background:' + color + '"></span></span><span class="hb-v">' + a[1] + '</span></button>'; }).join('');
  }
  function renderSec(rows) {
    var m = {}; SECS.forEach(function (s) { m[s] = { r: 0, e: 0 }; });
    rows.forEach(function (r) { if (!m[r.secretaria]) m[r.secretaria] = { r: 0, e: 0 }; if (r.tipo === 'Reclamação') m[r.secretaria].r++; else if (r.tipo === 'Elogio') m[r.secretaria].e++; });
    var arr = Object.keys(m).map(function (k) { return [k, m[k].r, m[k].e]; }).filter(function (a) { return a[1] + a[2] > 0; }).sort(function (a, b) { return b[1] - a[1]; });
    var box = $('chSec');
    if (!arr.length) { box.innerHTML = '<div class="empty">Sem reclamações ou elogios com estes filtros.</div>'; return; }
    var max = Math.max.apply(null, arr.map(function (a) { return Math.max(a[1], a[2]); }));
    box.innerHTML = arr.map(function (a) { return '<button type="button" class="gb" data-sec="' + esc(a[0]) + '" data-tip="' + esc(a[0]) + '|' + a[1] + ' reclamações · ' + a[2] + ' elogios"><span class="hb-l">' + esc(a[0]) + '</span><span class="pair">' +
      '<span class="ln"><span class="hb-t"><span class="hb-f" style="width:' + (a[1] / max * 100).toFixed(1) + '%;background:var(--s-recl)"></span></span><span>' + a[1] + '</span></span>' +
      '<span class="ln"><span class="hb-t"><span class="hb-f" style="width:' + (a[2] / max * 100).toFixed(1) + '%;background:var(--s-elog)"></span></span><span>' + a[2] + '</span></span></span></button>'; }).join('');
  }
  $('chSec').addEventListener('click', function (e) { var b = e.target.closest('[data-sec]'); if (!b || (me && me.perfil === 'secretaria')) return; $('fSec').value = b.getAttribute('data-sec'); renderAdmin(); toast('Filtrado: ' + b.getAttribute('data-sec')); });
  ['chRecl', 'chElog'].forEach(function (id) { $(id).addEventListener('click', function (e) { var b = e.target.closest('[data-q]'); if (!b) return; $('fQ').value = b.getAttribute('data-q'); renderInbox(currentFiltered); document.querySelector('.inbox-h').scrollIntoView({ behavior: 'smooth', block: 'start' }); }); });

  var tip = $('ctip');
  function showTip(el, x, y) { var p = el.getAttribute('data-tip').split('|'); tip.innerHTML = '<b>' + esc(p[0]) + '</b><br>' + esc(p[1]); tip.hidden = false; var w = tip.offsetWidth, h = tip.offsetHeight; tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x + 12)) + 'px'; tip.style.top = Math.max(8, y - h - 12) + 'px'; }
  document.addEventListener('mousemove', function (e) { var el = e.target.closest && e.target.closest('[data-tip]'); if (el) showTip(el, e.clientX, e.clientY); else tip.hidden = true; });
  document.addEventListener('focusin', function (e) { var el = e.target.closest && e.target.closest('[data-tip]'); if (el) { var r = el.getBoundingClientRect(); showTip(el, r.left + r.width / 2, r.top); } else tip.hidden = true; });
  document.addEventListener('scroll', function () { tip.hidden = true; }, true);

  function mediaIcons(r) { var k = {}; (r.midias || []).forEach(function (m) { k[m.kind] = 1; }); return Object.keys(k).map(function (x) { return '<svg class="i" aria-label="' + x + '"><use href="#' + KIND_IC[x] + '"/></svg>'; }).join(''); }
  function renderInbox(f) {
    var q = $('fQ').value.trim().toLowerCase();
    var rows = q ? f.filter(function (r) { return [r.protocolo, r.assunto, r.unidade, r.bairro, r.endereco, r.descricao, r.secretaria].join(' ').toLowerCase().indexOf(q) >= 0; }) : f.slice();
    rows.sort(function (a, b) { var la = isLate(a), lb = isLate(b); if (la !== lb) return la ? -1 : 1; return a.criada < b.criada ? 1 : -1; });
    $('inboxCount').textContent = rows.length + (rows.length === 1 ? ' manifestação' : ' manifestações') + ' · fora do prazo primeiro';
    var shown = rows.slice(0, adm.limit);
    $('inbox').innerHTML = shown.length ? shown.map(function (r) {
      return '<tr tabindex="0" data-p="' + esc(r.protocolo) + '"><td><span class="mono">' + esc(r.protocolo) + '</span>' + (r.exemplo ? '<span class="tag-ex" style="margin-left:0;margin-top:2px;display:inline-block">exemplo</span>' : '') + '</td>' +
        '<td><span class="chip t-' + esc(r.tipo) + '">' + esc(r.tipo) + '</span></td>' +
        '<td class="c-assunto">' + esc(r.assunto) + '<small>' + esc([r.unidade, r.endereco, r.bairro].filter(Boolean).join(' · ') || 'Local não informado') + '</small></td>' +
        '<td class="c-sec">' + esc(r.secretaria) + '</td><td class="c-data">' + fmtD(new Date(r.criada)) + '</td>' +
        '<td class="c-midia"><span class="media-ics">' + mediaIcons(r) + '</span>' + (r.sinalizada ? ' <span class="flag">impróprio</span>' : '') + '</td><td>' + stBadge(r) + '</td></tr>';
    }).join('') : '<tr><td colspan="7"><div class="empty">Nenhuma manifestação com estes filtros.</div></td></tr>';
    $('moreBtn').hidden = rows.length <= adm.limit;
  }
  function findAdm(p) { if (real[p]) return real[p]; if (DEMO) for (var i = 0; i < DEMO.length; i++) if (DEMO[i].protocolo === p) return DEMO[i]; return null; }
  $('inbox').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-p]'); if (tr) openDrawer(tr.getAttribute('data-p')); });
  $('inbox').addEventListener('keydown', function (e) { if (e.key === 'Enter') { var tr = e.target.closest('tr[data-p]'); if (tr) openDrawer(tr.getAttribute('data-p')); } });

  /* ================= Detalhe ================= */
  var drawerFocus = null;
  function openDrawer(p) { var r = findAdm(p); if (!r) return; adm.open = p; drawerFocus = document.activeElement; renderDrawer(r, true); $('dwStatus').value = r.status; $('dwSec').value = r.secretaria; $('dwMsg').value = ''; $('drawer').hidden = false; document.body.classList.add('modal-open'); $('dwClose').focus(); }
  function closeDrawer() { if ($('drawer').hidden) return; $('drawer').hidden = true; adm.open = null; document.body.classList.remove('modal-open'); if (drawerFocus && drawerFocus.focus) drawerFocus.focus(); }
  $('dwClose').addEventListener('click', closeDrawer);
  $('drawer').addEventListener('click', function (e) { if (e.target === this) closeDrawer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !$('drawer').hidden && !document.querySelector('.modal:not([hidden])')) closeDrawer(); });

  var urlCache = {};
  function signedUrls(paths) {
    var need = paths.filter(function (p) { return !urlCache[p] || urlCache[p].exp < Date.now(); });
    if (!need.length) return Promise.resolve();
    return sb.storage.from('midias').createSignedUrls(need, 3600).then(function (res) {
      (res.data || []).forEach(function (x) { if (x.signedUrl) urlCache[x.path] = { url: x.signedUrl, exp: Date.now() + 55 * 60e3 }; });
    });
  }
  function renderDrawer(r, fetchMedia) {
    var pf = me.perfil;
    $('dwNum').textContent = r.protocolo;
    $('dwTags').innerHTML = '<span class="chip t-' + esc(r.tipo) + '">' + esc(r.tipo) + '</span>' + stBadge(r) + (r.exemplo ? '<span class="tag-ex" style="margin:0">exemplo</span>' : '') + (r.sinalizada ? '<span class="st st-late">Conteúdo sinalizado</span>' : '');
    var h = '';
    h += '<div><div class="sec-t">Assunto</div><div>' + esc(r.assunto) + ' · <b>' + esc(r.secretaria) + '</b></div></div>';
    h += '<div><div class="sec-t">Local</div><div>' + esc([r.unidade, r.endereco, r.bairro].filter(Boolean).join(' · ') || 'Não informado') + '</div></div>';
    h += '<div><div class="sec-t">Relato</div><div class="relato">' + esc(r.descricao) + '</div></div>';
    var mids = r.midias || [];
    h += '<div><div class="sec-t">Fotos, vídeos e áudios (' + mids.length + ')</div>';
    if (!mids.length) h += '<div class="help">Nenhum arquivo enviado.</div>';
    else if (pf === 'consulta') h += '<div class="help">O perfil Consulta não abre os arquivos enviados.</div>';
    else {
      h += '<div class="gallery">';
      mids.forEach(function (m) {
        var c = urlCache[m.path], src = c ? c.url : null, cap = '<div class="cap"><svg class="i i-sm"><use href="#' + KIND_IC[m.kind] + '"/></svg><span>' + esc(m.nome || m.kind) + '</span></div>';
        if (!m.path) { h += '<div class="gal-item"><div class="gal-ph"><svg class="i"><use href="#' + KIND_IC[m.kind] + '"/></svg>Mídia de exemplo<br>(sem arquivo)</div>' + cap + '</div>'; return; }
        if (!src) { h += '<div class="gal-item"><div class="gal-ph"><svg class="i"><use href="#' + KIND_IC[m.kind] + '"/></svg>Carregando…</div>' + cap + '</div>'; return; }
        if (m.kind === 'imagem') h += '<div class="gal-item"><a href="' + esc(src) + '" target="_blank" rel="noopener"><img src="' + esc(src) + '" alt="Foto enviada: ' + esc(m.nome) + '" loading="lazy"></a>' + cap + '</div>';
        else if (m.kind === 'video') h += '<div class="gal-item"><video src="' + esc(src) + '" controls preload="metadata" playsinline></video>' + cap + '</div>';
        else if (m.kind === 'audio') h += '<div class="gal-item"><div class="audio-box"><svg class="i" style="width:30px;height:30px"><use href="#i-mic"/></svg></div><audio src="' + esc(src) + '" controls preload="metadata"></audio>' + cap + '</div>';
        else h += '<div class="gal-item"><a class="gal-ph" href="' + esc(src) + '" target="_blank" rel="noopener"><svg class="i"><use href="#i-doc"/></svg>Abrir PDF</a>' + cap + '</div>';
      });
      h += '</div>';
    }
    h += '</div>';
    if (r.modo === 'anonima') h += '<div class="idbox"><b>Manifestação anônima</b><span class="help">Nenhum dado pessoal coletado.</span></div>';
    else if (pf === 'consulta') h += '<div class="idbox"><b>Dados pessoais ocultos</b><span class="help">O perfil Consulta não vê nome nem contato de quem se manifestou.</span></div>';
    else if (pf === 'secretaria' && r.modo === 'sigilo') h += '<div class="idbox sig"><b>Identidade sob sigilo</b><span style="font-size:.85rem">Só a Ouvidoria vê quem fez esta manifestação (Lei 13.460/2017, art. 10, §7º; Lei 13.608/2018, art. 4º-B). Para pedir mais informações ao cidadão, peça à Ouvidoria.</span></div>';
    else h += '<div class="idbox' + (r.modo === 'sigilo' ? ' sig' : '') + '"><b>' + esc(r.nome || '—') + '</b><span>' + esc([r.whats, r.email].filter(Boolean).join(' · ') || 'Sem contato informado') + '</span>' +
      (r.modo === 'sigilo' ? '<span style="font-size:.85rem;font-weight:600">Identidade sob sigilo: não repassar à secretaria (Lei 13.460/2017, art. 10, §7º; Lei 13.608/2018, art. 4º-B).</span>' : '<span class="help">Identificada. Avisos por ' + esc((r.avisos || []).join(' e ') || '—') + '.</span>') + '</div>';
    if (r.ciencia && r.ciencia.em) h += '<div class="help"><svg class="i i-sm" style="vertical-align:-4px;color:var(--ok)"><use href="#i-check"/></svg> Aviso legal e de privacidade aceitos em ' + fmtDT(new Date(r.ciencia.em)) + '.</div>';
    h += '<div><div class="sec-t">Andamento</div><ol class="tl">';
    (r.eventos || []).forEach(function (e) { h += '<li class="done-s"><div class="rail"><span class="dot"><svg class="i"><use href="#i-check"/></svg></span><span class="line"></span></div><div class="body"><b>' + esc(e.t) + '</b><small>' + fmtDT(new Date(e.d)) + (e.por === 'cidadao' ? ' · pelo cidadão' : e.por === 'interno' ? ' · registro interno' : '') + (e.autor && pf !== 'consulta' ? ' · por ' + esc(e.autor) : '') + '</small>' + (e.msg ? '<div class="msg">' + esc(e.msg) + '</div>' : '') + '</div></li>'; });
    h += '</ol></div>';
    $('dwBody').innerHTML = h;
    var ro = !!r.exemplo || pf === 'consulta';
    Array.prototype.forEach.call($('dwForm').querySelectorAll('select,textarea,button'), function (x) { x.disabled = ro; });
    if (pf === 'secretaria') $('dwSec').disabled = true;
    $('dwFlag').hidden = pf !== 'ouvidor';
    $('dwFlag').innerHTML = '<svg class="i i-sm"><use href="#i-flag"/></svg>' + (r.sinalizada ? 'Remover sinalização' : 'Sinalizar conteúdo impróprio');
    $('dwNote').hidden = !ro; $('dwNote').textContent = pf === 'consulta' ? 'Perfil Consulta: somente leitura.' : 'Manifestação de exemplo: não pode ser alterada.';
    if (fetchMedia && pf !== 'consulta') {
      var paths = mids.filter(function (m) { return m.path; }).map(function (m) { return m.path; });
      if (paths.length) signedUrls(paths).then(function () { if (adm.open === r.protocolo) renderDrawer(r, false); });
    }
  }
  var saving = false;
  function saveAdm(r, patch, okMsg) {
    if (saving) return; saving = true; $('dwSave').disabled = true;
    sb.from('manifestacoes').update(patch).eq('id', r._id).then(function (res) {
      if (res.error) { console.error(res.error); toast('Não foi possível salvar. Tente de novo.'); return; }
      toast(okMsg); loadData();
    }).then(function () { saving = false; $('dwSave').disabled = false; });
  }
  $('dwForm').addEventListener('submit', function (e) {
    e.preventDefault(); var r = adm.open && real[adm.open]; if (!r || me.perfil === 'consulta') return;
    var st = $('dwStatus').value, sec = me.perfil === 'secretaria' ? r.secretaria : $('dwSec').value, msg = $('dwMsg').value.trim(), now = new Date().toISOString(), who = me.nome;
    var ev = (r.eventos || []).slice();
    if (sec !== r.secretaria) ev.push({ t: 'Encaminhada à ' + sec, d: now, por: 'ouvidoria', autor: who });
    if (st !== r.status && !(st === 'Encaminhada' && sec !== r.secretaria)) { var o = { t: st === 'Em análise' ? 'Em análise pela Ouvidoria' : st, d: now, por: 'ouvidoria', autor: who }; if (msg) o.msg = msg; ev.push(o); }
    else if (msg) ev.push({ t: me.perfil === 'secretaria' ? 'Atualização da ' + r.secretaria : 'Atualização da Ouvidoria', d: now, msg: msg, por: 'ouvidoria', autor: who });
    if (ev.length === (r.eventos || []).length) { toast('Nada para salvar.'); return; }
    var patch = { status: st, eventos: ev }; if (me.perfil !== 'secretaria') patch.secretaria = sec;
    saveAdm(r, patch, 'Andamento salvo. O cidadão já vê a atualização.');
    $('dwMsg').value = '';
  });
  $('dwFlag').addEventListener('click', function () {
    var r = adm.open && real[adm.open]; if (!r || me.perfil !== 'ouvidor') return;
    var ev = (r.eventos || []).slice(); ev.push({ t: r.sinalizada ? 'Sinalização de conteúdo removida' : 'Conteúdo sinalizado como impróprio e preservado como registro', d: new Date().toISOString(), por: 'interno', autor: me.nome });
    saveAdm(r, { sinalizada: !r.sinalizada, eventos: ev }, r.sinalizada ? 'Sinalização removida' : 'Conteúdo sinalizado e preservado');
  });

  /* ================= Equipe ================= */
  $('teamBtn').addEventListener('click', function () {
    if (!me || me.perfil !== 'ouvidor') return;
    $('tmSec').innerHTML = SECS.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
    loadTeam(); O.openModal('m-team');
  });
  $('tmRole').addEventListener('change', function () { $('tmSecWrap').hidden = this.value !== 'secretaria'; });
  function loadTeam() {
    sb.from('equipe').select('email,nome,perfil,secretaria,ativo,criado_em,criado_por').order('nome').then(function (res) {
      if (res.error) { $('teamList').innerHTML = '<div class="help">Não foi possível carregar a equipe.</div>'; return; }
      equipe = res.data; renderTeam();
    });
  }
  function renderTeam() {
    $('teamList').innerHTML = equipe.map(function (u) {
      var mine = me && u.email === me.email;
      return '<div class="tm' + (u.ativo ? '' : ' off') + '"><div class="nm"><b>' + esc(u.nome) + (mine ? ' (você)' : '') + '</b><small>' + esc(u.email) + ' · ' + (u.ativo ? 'acesso liberado' : 'acesso desativado') + '</small></div>' +
        '<span class="pbadge p-' + u.perfil + '">' + esc(PERFIS[u.perfil]) + (u.perfil === 'secretaria' ? ' · ' + esc(u.secretaria) : '') + '</span>' +
        (mine ? '' : '<div class="acts"><button type="button" data-toggle="' + esc(u.email) + '">' + (u.ativo ? 'Desativar' : 'Reativar') + '</button></div>') + '</div>';
    }).join('') || '<div class="help">Ninguém cadastrado ainda.</div>';
  }
  $('teamList').addEventListener('click', function (e) {
    var t = e.target.closest('[data-toggle]'); if (!t) return;
    var u = equipe.filter(function (x) { return x.email === t.getAttribute('data-toggle'); })[0]; if (!u) return;
    t.disabled = true;
    sb.from('equipe').update({ ativo: !u.ativo }).eq('email', u.email).then(function (res) {
      toast(res.error ? 'Não foi possível alterar.' : u.ativo ? 'Acesso desativado' : 'Acesso reativado'); loadTeam();
    });
  });
  $('teamForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var nm = $('tmName').value.trim(), em = $('tmEmail').value.trim().toLowerCase(), role = $('tmRole').value, sec = role === 'secretaria' ? $('tmSec').value : null;
    if (nm.length < 3) return showErr('tmErr', 'Informe o nome completo.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return showErr('tmErr', 'Informe um e-mail válido.');
    if (equipe.some(function (u) { return u.email === em; })) return showErr('tmErr', 'Este e-mail já está na equipe.');
    showErr('tmErr', '');
    sb.from('equipe').insert({ email: em, nome: nm, perfil: role, secretaria: sec, ativo: true, criado_por: me.nome }).then(function (res) {
      if (res.error) { showErr('tmErr', 'Não foi possível cadastrar agora. Tente de novo.'); return; }
      $('tmName').value = ''; $('tmEmail').value = '';
      var b = $('tempBox'); b.hidden = false;
      b.innerHTML = '<b>' + esc(nm) + ' foi liberado(a).</b><span>Envie a ela o endereço deste painel. No primeiro acesso, ela toca em "Primeiro acesso: criar senha", usa o e-mail <b>' + esc(em) + '</b> e confirma pelo link que chega por e-mail.</span>';
      loadTeam();
    });
  });
})();
