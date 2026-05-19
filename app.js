(async function(){
  const DATA_URL = 'https://raw.githubusercontent.com/Ljx-maker-user/project03-ai-news-hub/main/articles.json';
  let data = await fetch(DATA_URL).then(r=>r.json()).catch(()=>[]);
  // load local posts from localStorage (demo publish)
  const localPosts = JSON.parse(localStorage.getItem('localPosts')||'[]');
  // mark local posts to avoid duplication if needed
  localPosts.forEach(p=> p.isLocal = true);
  data = localPosts.concat(data);

  const topModules = [
    "大模型与基础技术",
    "应用落地",
    "前沿探索",
    "基础设施与工具",
    "2025 年最热细分赛道"
  ];

  const moduleSelect = document.getElementById('moduleFilter');
  const moduleSet = Array.from(new Set(data.map(a=>a.module))).filter(Boolean);
  const modules = Array.from(new Set(topModules.concat(moduleSet))).filter(Boolean);
  modules.sort((a,b)=>{
    const ia = topModules.indexOf(a), ib = topModules.indexOf(b);
    if(ia!==-1 || ib!==-1) return (ia===-1?999:ia) - (ib===-1?999:ib);
    return a.localeCompare(b,'zh-CN');
  });
  modules.forEach(m=>{ const o = document.createElement('option'); o.value = m; o.textContent = m; moduleSelect.appendChild(o); });

  // top nav
  const topnav = document.getElementById('topnav');
  const homeLink = document.createElement('a'); homeLink.href='#'; homeLink.className='nav-link active'; homeLink.textContent='首页'; topnav.appendChild(homeLink);
  modules.forEach(m=>{ const a = document.createElement('a'); a.href='#'; a.className='nav-link'; a.textContent = m; a.addEventListener('click', (e)=>{ e.preventDefault(); setModuleFilter(m); }); topnav.appendChild(a); });

  const headerSearch = document.getElementById('headerSearch');
  const searchInput = document.getElementById('search');
  headerSearch.addEventListener('input', e=>{ searchInput.value = e.target.value; applyFilters(); });
  searchInput.addEventListener('input', e=>{ headerSearch.value = e.target.value; applyFilters(); });

  moduleSelect.addEventListener('change', ()=>{ const val=moduleSelect.value; [...topnav.querySelectorAll('.nav-link')].forEach(a=> a.classList.toggle('active', a.textContent===val || (val==='' && a.textContent==='首页'))); applyFilters(); });

  function setModuleFilter(m){
    moduleSelect.value = m;
    [...topnav.querySelectorAll('.nav-link')].forEach(a=> a.classList.toggle('active', a.textContent===m));
    window.scrollTo({top: document.querySelector('.center-col').offsetTop - 80, behavior:'smooth'});
    applyFilters();
  }

  function applyFilters(){
    let filtered = data.slice();
    const module = moduleSelect.value;
    const q = searchInput.value.trim().toLowerCase();
    if(module) filtered = filtered.filter(a=>a.module===module);
    if(q) filtered = filtered.filter(a=> ( (a.title||'') + (a.summary||'') + (a.author||'') + (a.tags||[]).join(' ') ).toLowerCase().includes(q));
    render(filtered);
    renderSubmodules(module||'');
    renderRankings();
  }

  function render(list){
    const container = document.getElementById('articles');
    container.innerHTML = '';
    const tpl = document.getElementById('article-template');
    list.forEach(a=>{
      const node = tpl.content.cloneNode(true);
      const art = node.querySelector('.article-card');
      const titleEl = art.querySelector('.title');
      titleEl.textContent = a.title || '无标题';
      titleEl.href = a.link || '#';
      art.querySelector('.meta').textContent = `${a.source||''} · ${formatDate(a.published)} · ${a.author||''} · ${a.module||''}`;
      art.querySelector('.summary').textContent = a.summary || '';
      const avatar = art.querySelector('.avatar');
      avatar.textContent = (a.author? a.author.trim()[0].toUpperCase() : (a.source? a.source.trim()[0].toUpperCase() : 'A'));
      container.appendChild(node);
    });
  }

  function formatDate(s){ if(!s) return ''; try{ const d=new Date(s); if(isNaN(d)) return s; return d.toLocaleString('zh-CN',{month:'numeric',day:'numeric'}); }catch(e){return s;} }

  function renderSubmodules(module){
    const el = document.getElementById('submodules'); el.innerHTML = '';
    const pool = module ? data.filter(a=>a.module===module) : data;
    const counts = {};
    pool.forEach(a=> (a.tags||[]).forEach(t=> counts[t] = (counts[t]||0)+1));
    const tags = Object.keys(counts).sort((a,b)=>counts[b]-counts[a]).slice(0,30);
    tags.forEach(t=>{ const li = document.createElement('li'); const btn = document.createElement('button'); btn.className='tag'; btn.textContent = `${t} (${counts[t]})`; btn.addEventListener('click', ()=>{ searchInput.value = t; headerSearch.value = t; applyFilters(); }); li.appendChild(btn); el.appendChild(li); });
    if(tags.length===0) el.innerHTML = '<li><small>暂无细分</small></li>';
  }

  function renderRankings(){
    const rankEl = document.getElementById('rankList'); rankEl.innerHTML = '';
    const authorCounts = {};
    data.forEach(a=>{ const au = (a.author||'').split(',')[0].trim() || a.source || '匿名'; authorCounts[au] = (authorCounts[au]||0)+1; });
    Object.entries(authorCounts).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v])=>{ const li = document.createElement('li'); li.textContent = `${k} (${v})`; rankEl.appendChild(li); });
  }

  document.getElementById('publishBtn').addEventListener('click', ()=>{
    const title = prompt('文章标题：'); if(!title) return; const summary = prompt('摘要：')||'';
    const post = { title, summary, link:'#', author:'你', published: new Date().toISOString(), source:'本地', module:'', tags:[], isLocal:true };
    localPosts.unshift(post);
    localStorage.setItem('localPosts', JSON.stringify(localPosts));
    data = localPosts.concat(data.filter(a=>!a.isLocal));
    applyFilters();
    alert('发布已保存到本地（localStorage），仅作示例展示');
  });

  document.getElementById('loginBtn').addEventListener('click', ()=>{ alert('登录示例：尚未实现后端（仅前端演示）'); });

  // init
  render(data);
  renderSubmodules('');
  renderRankings();

})();