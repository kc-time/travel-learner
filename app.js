const stateKey = 'italianoTravelStateV1';
function freshState(){ return { streak:0, lastStudyDate:null, items:{}, completedSessions:0 }; }
let appState = loadState();
let currentLesson = [];
let currentIndex = 0;
let sessionStats = { correct:0, wrong:0, newWords:0 };
let lessonMode = 'daily';
let activeTopic = null;

const $ = (id) => document.getElementById(id);
const views = [...document.querySelectorAll('.view')];

function loadState(){
  const base = freshState();
  try {
    const saved = JSON.parse(localStorage.getItem(stateKey));
    if(!saved || typeof saved !== 'object') return base;
    return { ...base, ...saved, items: { ...(saved.items || {}) } };
  } catch { return base; }
}
function saveState(){ localStorage.setItem(stateKey, JSON.stringify(appState)); refreshHome(); }
function itemState(id){
  if(!appState.items[id]) appState.items[id] = {score:0, correct:0, wrong:0, streak:0, due:0, seen:false};
  return appState.items[id];
}
function showView(id){ views.forEach(v=>v.classList.toggle('active', v.id===id)); }
function todayStr(){ return new Date().toISOString().slice(0,10); }
function refreshStreakOnComplete(){
  const today = todayStr();
  if(appState.lastStudyDate === today) return;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  const y = yesterday.toISOString().slice(0,10);
  appState.streak = appState.lastStudyDate === y ? appState.streak + 1 : 1;
  appState.lastStudyDate = today;
}
function refreshHome(){
  const vals = VOCAB.map(v=>itemState(v.id));
  const mastered = vals.filter(s=>s.score>=4).length;
  const seen = vals.filter(s=>s.seen || s.score>=1).length;
  const weak = vals.filter(s=>s.wrong>0 && s.score<3).length;
  $('streakStat').textContent = appState.streak || 0;
  $('masteredStat').textContent = mastered;
  $('weakStat').textContent = weak;
  $('mistakesCount').textContent = `${weak} 個`;
  $('progressText').textContent = `${Math.round((seen/VOCAB.length)*100)}% 已學`;
  $('reviewHint').textContent = seen ? `${seen} 個舊字 · 只練聽力同開咪` : '未有舊字，先做今日課程';
  $('reviewBtn').disabled = seen===0;
}

function buildTopics(){
  const icons = {'餐廳':'🍝','Café':'☕','火車':'🚆','問路':'🗺️','購物':'🛍️','付款':'💳','求助':'🆘','飲品':'🍷','酒店':'🏨','基本':'💬'};
  const topics = [...new Set(VOCAB.map(v=>v.topic))];
  $('topicGrid').innerHTML = topics.map(t=>`<button class="topic-card" data-topic="${t}"><span class="emoji">${icons[t]||'📚'}</span><strong>${t}</strong><br><span>${VOCAB.filter(v=>v.topic===t).length} 個字</span></button>`).join('');
  document.querySelectorAll('[data-topic]').forEach(btn=>btn.addEventListener('click',()=>startTopic(btn.dataset.topic)));
}

function weightedDailySelection(){
  const dueWeak = VOCAB.filter(v=>{const s=itemState(v.id); return s.wrong>0 && s.score<4;});
  const unseen = VOCAB.filter(v=>!itemState(v.id).seen);
  const known = VOCAB.filter(v=>itemState(v.id).seen);
  const pick = [];
  shuffle(dueWeak).slice(0,4).forEach(v=>pick.push(v));
  shuffle(unseen).slice(0,10).forEach(v=>{if(!pick.find(x=>x.id===v.id) && pick.length<10) pick.push(v);});
  shuffle(known).forEach(v=>{if(!pick.find(x=>x.id===v.id) && pick.length<10) pick.push(v);});
  return pick.slice(0,10);
}
function uniqueById(list){
  const out=[];
  list.forEach(v=>{ if(!out.find(x=>x.id===v.id)) out.push(v); });
  return out;
}
function buildQuestionQueue(pool){
  const words = uniqueById(pool);
  const unseen = words.filter(v=>!itemState(v.id).seen);
  const known = words.filter(v=>itemState(v.id).seen);
  const qs=[];
  const intro = unseen.slice(0,4);
  intro.forEach(v=>{
    qs.push({item:v, type:'speak', afterLearn:true});
  });
  const quizPool = known.length || intro.length ? [...known, ...intro] : words;
  let n=0;
  while(qs.length<10 && quizPool.length){
    const type = intro.length ? 'choice' : (n%2===0 ? 'choice' : 'speak');
    qs.push({item: quizPool[n % quizPool.length], type});
    n++;
    if(n>40) break;
  }
  return qs.slice(0,10);
}
function startLesson(queue){
  currentLesson = queue;
  sessionStats = {correct:0, wrong:0, newWords:queue.filter(q=>q.afterLearn || q.type==='learn').length};
  currentIndex=0; showView('lessonView'); renderQuestion();
}
function startDaily(){
  lessonMode='daily'; activeTopic=null;
  startLesson(buildQuestionQueue(weightedDailySelection()));
}
function startTopic(topic){
  lessonMode='topic'; activeTopic=topic;
  startLesson(buildQuestionQueue(shuffle(VOCAB.filter(v=>v.topic===topic))));
}
function reviewPool(){
  const known = VOCAB.filter(v=>itemState(v.id).seen);
  const weak = known.filter(v=>{ const s=itemState(v.id); return s.wrong>0 || s.score<4; });
  const rest = known.filter(v=>!weak.find(x=>x.id===v.id));
  return uniqueById([...shuffle(weak), ...shuffle(rest)]);
}
function buildReviewQueue(){
  const pool = reviewPool();
  if(!pool.length) return [];
  const take = pool.slice(0, Math.min(10, pool.length));
  const qs=[];
  let n=0;
  while(qs.length<10){
    qs.push({item: take[n % take.length], type: n%2===0 ? 'choice' : 'speak'});
    n++;
    if(n>40) break;
  }
  return qs.slice(0,10);
}
function startReview(){
  const queue = buildReviewQueue();
  if(!queue.length){
    $('reviewEmptyModal').classList.remove('hidden');
    return;
  }
  lessonMode='review'; activeTopic=null;
  startLesson(queue);
}
function shuffle(arr){ return [...arr].sort(()=>Math.random()-.5); }

function renderQuestion(){
  const q = currentLesson[currentIndex];
  if(!q) return finishLesson();
  const item = q.item;
  const qType = q.type;
  const s = itemState(item.id);
  $('lessonLabel').textContent = lessonMode==='daily' ? '每日課程' : lessonMode==='review' ? '舊字重溫' : activeTopic;
  $('lessonCounter').textContent = `${currentIndex+1}/${currentLesson.length}`;
  $('lessonProgress').style.width = `${((currentIndex)/currentLesson.length)*100}%`;
  $('feedback').className='feedback hidden'; $('feedback').innerHTML=''; $('nextBtn').classList.add('hidden');
  $('visualCue').textContent=item.emoji;
  $('promptText').textContent=item.it;
  $('subPrompt').textContent=item.zh;
  $('exampleIt').textContent=item.example;
  $('exampleZh').textContent=item.exZh;
  const area=$('answerArea'); area.innerHTML='';

  if(qType==='learn'){
    $('questionType').textContent = s.seen ? '重溫' : '新字';
    setAudioControls(item, {word:true, example:true, revealExample:true});
    area.innerHTML='<button class="next-btn" id="learnedBtn">記住，下一步</button>';
    $('learnedBtn').onclick=()=>{ s.seen=true; s.score=Math.max(1,s.score); saveState(); nextQuestion(); };
  } else if(qType==='choice') {
    $('questionType').textContent='聽力選擇 · 舊字重溫';
    $('promptText').textContent='聽完之後揀意思'; $('subPrompt').textContent='';
    setAudioControls(item, {word:true, example:false, revealExample:false});
    setTimeout(()=>speakItalian(item.it), 80);
    const wrongs=shuffle(VOCAB.filter(v=>v.id!==item.id)).slice(0,3);
    const options=shuffle([item,...wrongs]);
    options.forEach(opt=>{
      const b=document.createElement('button'); b.className='choice-btn'; b.textContent=opt.zh;
      b.onclick=()=>gradeChoice(b,opt.id===item.id,item); area.appendChild(b);
    });
  } else {
    const teach = !!q.afterLearn;
    $('questionType').textContent = teach ? '新字 · 開咪講' : '開咪講答案';
    if(teach){
      $('subPrompt').textContent='聽完，用意大利文講出嚟';
      setAudioControls(item, {word:true, example:true, revealExample:true});
      s.seen=true; s.score=Math.max(1,s.score); saveState();
      setTimeout(()=>speakItalian(item.it), 80);
    } else {
      $('promptText').textContent=item.zh;
      $('subPrompt').textContent='用意大利文講出嚟';
      setAudioControls(item, {word:false, example:false, revealExample:false});
    }
    area.innerHTML='<button class="mic-btn" id="micBtn">🎤 按一下開始講</button><small id="speechNote" style="color:#6b7280">以聽得明為標準，不捉小文法錯。</small>';
    $('micBtn').onclick=()=>startRecognition(item);
  }
}
function answerLine(item){
  return `答案係：<strong>${item.it}</strong> — ${item.zh}`;
}
function setAudioControls(item, {word, example, revealExample}){
  $('speakWordBtn').classList.toggle('hidden', !word);
  $('speakExampleBtn').classList.toggle('hidden', !example);
  $('audioRow').classList.toggle('hidden', !word && !example);
  $('audioRow').classList.toggle('single', !!(word && !example));
  $('exampleBox').classList.toggle('hidden', !revealExample);
  if(word) $('speakWordBtn').onclick=()=>speakItalian(item.it);
  if(example) $('speakExampleBtn').onclick=()=>speakItalian(item.example || item.it);
}
function revealAfterGrade(item){
  setAudioControls(item, {word:true, example:true, revealExample:true});
}
function gradeChoice(btn, ok, item){
  [...document.querySelectorAll('.choice-btn')].forEach(b=>b.disabled=true);
  btn.classList.add(ok?'correct':'wrong');
  if(ok) recordResult(item,true,1); else recordResult(item,false,0);
  revealAfterGrade(item);
  showFeedback(ok?'good':'bad', ok?`啱。${answerLine(item)}`:answerLine(item));
}
function normalize(s){
  return (s||'')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[''`´]/g,'')
    .replace(/[^a-z]+/g,' ')
    .replace(/\s+/g,' ')
    .trim();
}
function compact(s){ return normalize(s).replace(/\s+/g,''); }
function contentTokens(s){
  const stops = new Set(['per','con','una','uno','il','la','lo','le','gli','un','di','a','da','in','su','e','o','che','mi','ti','si','ci','vi']);
  return normalize(s).split(' ').filter(x=>x.length>1 && !stops.has(x));
}
function similarity(a,b){
  if(!a && !b) return 1;
  if(!a || !b) return 0;
  return 1 - levenshtein(a,b)/Math.max(a.length,b.length);
}
function tokenHits(heardTokens, key){
  return heardTokens.some(h=>h===key || h.includes(key) || key.includes(h) || levenshtein(h,key)<=Math.min(2, Math.floor(key.length/3)||1));
}
function gradeSpeech(item, transcripts){
  const rank = {exact:5, strong:4, ok:3, partial:2, poor:1};
  let best = {tier:'poor', score:0, heard: transcripts[0]||''};
  transcripts.forEach(raw=>{
    const heard = normalize(raw);
    const heardC = compact(raw);
    const heardKeys = contentTokens(raw);
    if(!heard) return;
    [item.it, item.example].filter(Boolean).forEach((targetRaw, ti)=>{
      const target = normalize(targetRaw);
      const targetC = compact(targetRaw);
      const tKeys = contentTokens(targetRaw);
      const sim = Math.max(similarity(heard,target), similarity(heardC,targetC));
      const matched = tKeys.filter(k=>tokenHits(heardKeys,k));
      const keyRatio = tKeys.length ? matched.length/tKeys.length : 0;
      const exactMatch = heard===target || heardC===targetC || sim>=0.92;
      const contained = !exactMatch && !!(target && (heard.includes(target) || heardC.includes(targetC)));
      let tier = 'poor';
      if(exactMatch) tier = 'exact';
      else if(sim>=0.80 || keyRatio>=0.9 || (tKeys.length && matched.length===tKeys.length) || contained)
        tier = 'strong';
      else if(keyRatio>=0.65) tier = 'ok';
      else if(matched.length>=1) tier = 'partial';
      const score = sim + (ti===0 ? 0.001 : 0);
      if(rank[tier]>rank[best.tier] || (rank[tier]===rank[best.tier] && score>best.score))
        best = {tier, score, heard:raw};
    });
  });
  return best;
}
function speechPass(tier){ return tier==='exact' || tier==='strong' || tier==='ok'; }
function speechHeadline(tier){
  if(tier==='exact') return '講得好！✅<br>完全正確';
  if(tier==='strong') return '好接近 👍';
  if(tier==='ok') return '對方聽得明 👍';
  if(tier==='partial') return '有啱一部分，再試一次 💪';
  return '未熟，聽一次再試';
}
function speechFeedbackClass(tier){
  if(tier==='exact' || tier==='strong') return 'good';
  if(tier==='ok') return 'near';
  if(tier==='partial') return 'near';
  return 'bad';
}
function startRecognition(item){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    showFeedback('near','呢個 browser 暫時唔支援語音辨識。你可以當自己講咗，再撳「我講到」或「未識」。');
    $('answerArea').innerHTML='<button class="choice-btn" id="manualGood">我講到</button><button class="choice-btn" id="manualBad">未識</button>';
    $('manualGood').onclick=()=>{ recordResult(item,true); revealAfterGrade(item); showFeedback('good', `${speechHeadline('exact')}<br>${answerLine(item)}`); };
    $('manualBad').onclick=()=>{ recordResult(item,false); revealAfterGrade(item); showFeedback('bad', `${speechHeadline('poor')}<br>${answerLine(item)}`); speakItalian(item.it); };
    return;
  }
  const rec = new SR(); rec.lang='it-IT'; rec.interimResults=false; rec.maxAlternatives=3;
  $('micBtn').textContent='🎙️ 聽緊...'; $('micBtn').disabled=true;
  rec.onresult=(e)=>{
    const alts=[...e.results[0]].map(r=>r.transcript);
    const graded=gradeSpeech(item, alts.length?alts:['']);
    const ok=speechPass(graded.tier);
    recordResult(item,ok);
    revealAfterGrade(item);
    showFeedback(speechFeedbackClass(graded.tier), `${speechHeadline(graded.tier)}<br>聽到你講：「${graded.heard||'—'}」<br>${answerLine(item)}`);
    if(!ok) speakItalian(item.it);
  };
  rec.onerror=()=>showFeedback('near','收音唔成功。再試一次，或者檢查 Chrome 麥克風權限。');
  rec.onend=()=>{ if($('micBtn')){$('micBtn').textContent='🎤 再講一次';$('micBtn').disabled=false;} };
  rec.start();
}
function levenshtein(a,b){
  const m=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));
  for(let i=0;i<=a.length;i++)m[i][0]=i; for(let j=0;j<=b.length;j++)m[0][j]=j;
  for(let i=1;i<=a.length;i++)for(let j=1;j<=b.length;j++)m[i][j]=Math.min(m[i-1][j]+1,m[i][j-1]+1,m[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return m[a.length][b.length];
}
function recordResult(item, ok){
  const s=itemState(item.id); s.seen=true;
  if(ok){s.correct++; s.streak++; s.score=Math.min(5,s.score+1); sessionStats.correct++;}
  else {s.wrong++; s.streak=0; s.score=Math.max(0,s.score-1); sessionStats.wrong++;}
  s.due=Date.now() + (ok ? Math.pow(2,s.score)*86400000 : 4*3600000);
  saveState();
}
function showFeedback(type, html){
  $('feedback').className=`feedback ${type}`; $('feedback').innerHTML=html;
  $('nextBtn').classList.remove('hidden');
}
function nextQuestion(){ currentIndex++; renderQuestion(); }
let speakTimer = null;
function speakItalian(text){
  if(!('speechSynthesis' in window) || !text) return;
  const play = () => {
    clearTimeout(speakTimer);
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'it-IT';
    u.rate = 0.9;
    const it = speechSynthesis.getVoices().find(v => (v.lang||'').toLowerCase().startsWith('it'));
    if(it) u.voice = it;
    const kick = () => {
      try { speechSynthesis.resume(); } catch(e) {}
      speechSynthesis.speak(u);
    };
    if(speechSynthesis.speaking || speechSynthesis.pending){
      speechSynthesis.cancel();
      speakTimer = setTimeout(kick, 80);
    } else {
      kick();
    }
  };
  play();
  if(!speechSynthesis.getVoices().length){
    speechSynthesis.addEventListener('voiceschanged', play, {once:true});
  }
}
function finishLesson(){
  refreshStreakOnComplete(); appState.completedSessions++; saveState();
  $('lessonProgress').style.width='100%';
  $('completeTitle').textContent = lessonMode==='daily' ? '今日課程完成' : lessonMode==='review' ? '重溫完成' : `${activeTopic}練習完成`;
  const leftN = lessonMode==='review' ? new Set(currentLesson.map(q=>q.item.id)).size : sessionStats.newWords;
  const leftL = lessonMode==='review' ? '重溫字' : '新字';
  $('completeStats').innerHTML=`<div><strong>${leftN}</strong><span>${leftL}</span></div><div><strong>${sessionStats.correct}</strong><span>答啱</span></div><div><strong>${sessionStats.wrong}</strong><span>要再練</span></div>`;
  showView('completeView');
}
function renderMistakes(){
  const list=VOCAB.map(v=>({v,s:itemState(v.id)})).filter(x=>x.s.wrong>0).sort((a,b)=>b.s.wrong-a.s.wrong);
  $('mistakesList').innerHTML=list.length?list.map(({v,s})=>`<div class="list-item"><div><strong>${v.it}</strong><span>${v.zh}<br>${v.example}</span></div><div class="level">錯 ${s.wrong} 次</div></div>`).join(''):'<div class="list-item"><div><strong>暫時冇錯題</strong><span>做幾課之後會自動收集。</span></div></div>';
}
function renderProgress(){
  const groups={未熟:0,學習中:0,熟悉:0};
  VOCAB.forEach(v=>{const s=itemState(v.id); if(s.score>=4)groups.熟悉++; else if(s.score>=1)groups.學習中++; else groups.未熟++;});
  $('progressCards').innerHTML=Object.entries(groups).map(([k,n])=>`<div class="list-item"><div><strong>${k}</strong><span>${n} / ${VOCAB.length} 個字</span></div><div class="level">${Math.round(n/VOCAB.length*100)}%</div></div>`).join('');
}

$('dailyBtn').onclick=startDaily;
$('reviewBtn').onclick=startReview;
$('reviewEmptyOk').onclick=()=>$('reviewEmptyModal').classList.add('hidden');
$('reviewEmptyModal').addEventListener('click', (e)=>{ if(e.target.id==='reviewEmptyModal') $('reviewEmptyModal').classList.add('hidden'); });
$('topicBtn').onclick=()=>showView('topicView');
$('mistakesBtn').onclick=()=>{renderMistakes();showView('mistakesView');};
$('progressBtn').onclick=()=>{renderProgress();showView('progressView');};
$('nextBtn').onclick=nextQuestion;
$('homeBtn').onclick=()=>showView('homeView');
function openResetModal(){ $('resetModal').classList.remove('hidden'); }
function closeResetModal(){ $('resetModal').classList.add('hidden'); }
function resetProgress(){
  localStorage.removeItem(stateKey);
  appState=loadState();
  closeResetModal();
  showView('homeView');
  refreshHome();
}
$('resetBtn').onclick=openResetModal;
$('cancelResetBtn').onclick=closeResetModal;
$('confirmResetBtn').onclick=resetProgress;
$('resetModal').addEventListener('click', (e)=>{ if(e.target.id==='resetModal') closeResetModal(); });
document.querySelectorAll('[data-back]').forEach(b=>b.onclick=()=>showView('homeView'));

buildTopics(); refreshHome();
if('speechSynthesis' in window) speechSynthesis.getVoices();
