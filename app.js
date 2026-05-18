(async function(){
  const data = await fetch('https://raw.githubusercontent.com/Ljx-maker-user/project03-ai-news-hub/main/articles.json').then(r=>r.json()).catch(()=>[]);
  const modules = Array.from(new Set(data.map(a=>a.module))).filter(Boolean);
  const moduleSelect = document.getElementById('moduleFilter');
  modules.sort();
  modules.forEach(m=>{ const o = document.createElement('option'); o.value = m; o.textContent = m; moduleSelect.appendChild(o); });
  function render(list){
    const ul = document.getElementById('articles');
    ul.innerHTML = '';
    list.forEach((a,i)=>{
      const li = document.createElement('li');
      li.className = 'article';
      li.innerHTML = `<a class="title" href="${a.link}" target="_blank" rel="noopener">${a.title}</a>\n        <div class="meta">${a.source} · ${a.published || ''} · ${a.author || ''} · ${a.module}</div>\n        <p class="summary">${a.summary||''}</p>`;
      ul.appendChild(li);
    });
  }
  function applyFilters(){
    const q = document.getElementById('search').value.trim().toLowerCase();
    const module = moduleSelect.value;
    let filtered = data;
    if(module) filtered = filtered.filter(a=>a.module===module);
    if(q) filtered = filtered.filter(a=> (a.title+a.summary).toLowerCase().includes(q));
    render(filtered);
  }
  moduleSelect.addEventListener('change', applyFilters);
  document.getElementById('search').addEventListener('input', applyFilters);
  render(data);
  const tagsEl = document.getElementById('tags');
  const tagCounts = {};
  data.forEach(a=> (a.tags||[]).forEach(t=> tagCounts[t] = (tagCounts[t]||0)+1));
  const tags = Object.keys(tagCounts).slice(0,30);
  tags.forEach(t=>{ const b = document.createElement('button'); b.textContent = t; b.className='tag'; b.onclick = ()=>{ document.getElementById('search').value = t; applyFilters(); }; tagsEl.appendChild(b); });
})();
