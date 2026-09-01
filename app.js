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
  intro.forEach(v=>qs.push({item:v, type:'learn'}));
  const quizPool = known.length || intro.length ? [...known, ...intro] : words;
  let n=0;
  while(qs.length<10 && quizPool.length){
    qs.push({item: quizPool[n % quizPool.length], type: n%2===0 ? 'choice' : 'speak'});
    n++;
    if(n>40) break;
  }
  return qs.slice(0,10);
}
function startLesson(queue){
  currentLesson = queue;
  sessionStats = {correct:0, wrong:0, newWords:queue.filter(q=>q.type==='learn').length};
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
  $('exampleBox').classList.toggle('hidden', qType!=='learn');
  $('speakItalianBtn').onclick=()=>speakItalian(qType==='choice' ? item.it : (item.example || item.it));
  const area=$('answerArea'); area.innerHTML='';

  if(qType==='learn'){
    $('questionType').textContent = s.seen ? '重溫' : '新字';
    area.innerHTML='<button class="next-btn" id="learnedBtn">記住，下一步</button>';
    $('learnedBtn').onclick=()=>{ s.seen=true; s.score=Math.max(1,s.score); saveState(); nextQuestion(); };
  } else if(qType==='choice') {
    $('questionType').textContent='聽力選擇 · 舊字重溫';
    $('promptText').textContent='聽完之後揀意思'; $('subPrompt').textContent='';
    speakItalian(item.it);
    const wrongs=shuffle(VOCAB.filter(v=>v.id!==item.id)).slice(0,3);
    const options=shuffle([item,...wrongs]);
    options.forEach(opt=>{
      const b=document.createElement('button'); b.className='choice-btn'; b.textContent=opt.zh;
      b.onclick=()=>gradeChoice(b,opt.id===item.id,item); area.appendChild(b);
    });
  } else {
    $('questionType').textContent='開咪講答案';
    $('promptText').textContent=item.zh;
    $('subPrompt').textContent='用意大利文講出嚟';
    area.innerHTML='<button class="mic-btn" id="micBtn">🎤 按一下開始講</button><small id="speechNote" style="color:#6b7280">以聽得明為標準，不捉小文法錯。</small>';
    $('micBtn').onclick=()=>startRecognition(item);
  }
}
function gradeChoice(btn, ok, item){
  [...document.querySelectorAll('.choice-btn')].forEach(b=>b.disabled=true);
  btn.classList.add(ok?'correct':'wrong');
  if(ok) recordResult(item,true,1); else recordResult(item,false,0);
  showFeedback(ok?'good':'bad', ok?'啱。呢個字你聽得出。':`答案係：${item.it} — ${item.zh}`);
}
function normalize(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zà-ÿ' ]/g,' ').replace(/\s+/g,' ').trim(); }
function keywordTokens(item){
  return normalize(item.it).split(' ').filter(x=>x.length>2 && !['per','con','una','uno','il','la','lo','un'].includes(x));
}
function startRecognition(item){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    showFeedback('near','呢個 browser 暫時唔支援語音辨識。你可以當自己講咗，再撳「我講到」或「未識」。');
    $('answerArea').innerHTML='<button class="choice-btn" id="manualGood">我講到</button><button class="choice-btn" id="manualBad">未識</button>';
    $('manualGood').onclick=()=>recordResult(item,true,1);
    $('manualBad').onclick=()=>recordResult(item,false,0);
    return;
  }
  const rec = new SR(); rec.lang='it-IT'; rec.interimResults=false; rec.maxAlternatives=3;
  $('micBtn').textContent='🎙️ 聽緊...'; $('micBtn').disabled=true;
  rec.onresult=(e)=>{
    const alts=[...e.results[0]].map(r=>normalize(r.transcript));
    const keys=keywordTokens(item);
    const hit=alts.some(t=>keys.every(k=>t.includes(k)) || keys.some(k=>t.includes(k)));
    const near=alts.some(t=>keys.some(k=>levenshtein(t,k)<=2));
    const ok=hit||near;
    recordResult(item,ok,ok?1:0);
    showFeedback(ok?'good':'near', ok?`聽到你講：「${alts[0]}」<br>對方應該聽得明 👍`:`聽到你講：「${alts[0]||'—'}」<br>目標：<strong>${item.it}</strong><br>再聽一次正確發音。`);
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
function speakItalian(text){
  if(!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text); u.lang='it-IT'; u.rate=.9;
  const voices=speechSynthesis.getVoices(); const it=voices.find(v=>v.lang?.toLowerCase().startsWith('it'));
  if(it) u.voice=it; speechSynthesis.speak(u);
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
