(() => {
  const config=window.MISSU_BOOK_ACCESSORIES;
  if(!config?.enabled)return;
  const viewport=document.getElementById('viewport'),tabsLayer=document.createElement('div');
  tabsLayer.className='book-accessories book-tabs-layer';tabsLayer.setAttribute('role','group');tabsLayer.setAttribute('aria-label','日记章节索引，读完整本后可跳转');
  let width=1000,reading=null,signature='',currentLayout=null,completed=false,visited=new Set(),movingPaper=null;
  const tabs=config.tabs.map(tab=>{
    const node=document.createElement('button');node.type='button';node.className='book-index-tab';node.textContent=tab.label;node.dataset.tabId=tab.id;node.dataset.date=tab.date;node.disabled=true;
    for(const [key,value] of Object.entries({'--tab-width':`${tab.width}px`,'--tab-height':`${tab.height}px`,'--tab-angle':`${tab.angle}deg`,'--tab-paper':tab.color}))node.style.setProperty(key,value);
    const record={...tab,node,page:null};
    node.addEventListener('click',event=>{
      event.stopPropagation();if(!completed||reading?.busy)return;
      if(record.page!==null)window.wordLayoutTest.pick(record.page-1);
    });tabsLayer.append(node);return record;
  });
  viewport.append(tabsLayer);
  function resolveTarget(tab,layout){
    if(tab.anchor){const anchor=window.missuDiary.resolveAnchor(tab.anchor);return anchor?.date===tab.date?{page:anchor.pages[0]??null,ranges:anchor.ranges||[anchor]}:{page:null,ranges:[]};}
    const entry=window.missuDiary.document.entries.find(e=>e.date===tab.date);
    for(const paragraph of entry?.paragraphs||[]){
      const text=paragraph.tokens.map(t=>t.text).join(''),offset=text.indexOf(tab.text);if(offset<0)continue;
      const start=Array.from(text.slice(0,offset)).length,end=start+Array.from(tab.text).length;
      const page=layout.pages.find(p=>p.date===tab.date&&p.blocks.some(b=>b.paragraphId===paragraph.id&&b.end>start&&b.start<end));
      return{page:page?.number??null,ranges:[{paragraphId:paragraph.id,start,end}]};
    }
    return{page:null,ranges:[]};
  }
  function placeTabs(){
    const settings=config.placement,ordered=[...tabs].filter(t=>t.page!==null).sort((a,b)=>a.page-b.page);
    const occupied=ordered.reduce((sum,t)=>sum+t.height,0)+Math.max(0,ordered.length-1)*settings.minGap;
    const spare=Math.max(0,720-settings.top-settings.bottom-occupied),first=ordered[0]?.page??0,last=ordered.at(-1)?.page??first;
    let used=0;
    for(const tab of ordered){const progress=last>first?(tab.page-first)/(last-first):0;tab.position=tab.top??settings.top+used+spare*progress;tab.node.style.setProperty('--tab-top',`${tab.position}px`);used+=tab.height+settings.minGap;}
  }
  function bookSignature(){
    const content=JSON.stringify(window.missuDiary.document.entries.map(e=>[e.date,e.paragraphs.map(p=>p.tokens.map(t=>t.text).join(''))]));
    let hash=2166136261;for(let i=0;i<content.length;i++)hash=Math.imul(hash^content.charCodeAt(i),16777619);
    return`${window.missuDiary.layout.pages.length}:${(hash>>>0).toString(16)}`;
  }
  function restore(){
    const nextLayout=window.missuDiary.layout;if(currentLayout===nextLayout)return;currentLayout=nextLayout;
    const nextSignature=bookSignature();
    if(nextSignature!==signature){
      signature=nextSignature;completed=false;visited=new Set();
      try{const saved=JSON.parse(localStorage.getItem(config.progressKey));if(saved?.signature===signature){visited=new Set((saved.visited||[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=nextLayout.pages.length));completed=saved.completed===true&&visited.size===nextLayout.pages.length;}}catch{/* Session-only progress remains available when storage is disabled. */}
    }
    for(const tab of tabs){Object.assign(tab,resolveTarget(tab,nextLayout));tab.paperFront=tab.page===null?null:2*Math.floor((tab.page-1)/2)+1;}
    placeTabs();
  }
  function save(){try{localStorage.setItem(config.progressKey,JSON.stringify({signature,visited:[...visited].sort((a,b)=>a-b),completed}));}catch{/* The current reading session still unlocks normally. */}}
  function appearance(){
    if(!reading)return;
    const edge=reading.closed&&!reading.single?width/2:width;
    tabsLayer.style.setProperty('--book-edge',`${edge}px`);
    tabsLayer.dataset.unlocked=String(completed);
    tabsLayer.dataset.closed=String(reading.closed);
    const shown=reading.pages.map(p=>p.number),last=shown.length?Math.max(...shown):null;
    const active=last===null?null:tabs.filter(t=>t.page!==null&&t.page<=last).at(-1)?.id;
    for(const tab of tabs){
      const flipped=tab.paperFront!==null&&(reading.closed||!reading.cover&&(reading.single?(shown[0]??0)>tab.paperFront:reading.state>(tab.paperFront-1)/2));
      tab.node.dataset.side=flipped?'left':'right';
      tab.node.dataset.paperFront=tab.paperFront??'';
      tab.node.style.visibility=reading.busy&&movingPaper===tab.paperFront?'hidden':'';
      tab.node.disabled=!completed||reading.busy||tab.page===null;
      tab.node.setAttribute('aria-label',`${tab.label}${completed?'，跳至'+tab.date:'，读完整本后可跳转'}`);
      tab.node.title=tab.page===null?'未找到配置的剧情位置':completed?`${tab.label} · ${tab.date}`:'读完整本并合上封底后解锁';
      if(tab.id===active)tab.node.setAttribute('aria-current','location');else tab.node.removeAttribute('aria-current');
    }
    tabsLayer.setAttribute('aria-label',completed?'日记章节索引':'日记章节索引，读完整本后可跳转');
  }
  document.addEventListener('missu-reading-state',event=>{
    reading=event.detail;if(!reading.busy)movingPaper=null;restore();let changed=false;
    if(!reading.busy){
      for(const page of reading.pages)if(!visited.has(page.number)){visited.add(page.number);changed=true;}
      if(!completed&&visited.size===reading.pageCount&&reading.closed){completed=true;changed=true;document.dispatchEvent(new CustomEvent('missu-reading-complete',{detail:{signature,pages:reading.pageCount}}));}
      if(changed)save();
    }
    appearance();
  });
  document.addEventListener('missu-book-fit',event=>{
    const fit=event.detail;width=fit.width;
    tabsLayer.style.width=`${fit.width}px`;tabsLayer.style.height=`${fit.height}px`;tabsLayer.style.transform=`scale(${fit.scale})`;
    appearance();
  });
  document.addEventListener('missu-sheet-created',event=>{
    const {sheet,single}=event.detail;
    const front=Number(sheet.querySelector('.front .hb-page[data-page]')?.dataset.page),back=Number(sheet.querySelector('.back .hb-page[data-page]')?.dataset.page);
    if(!front||front%2!==1||back!==front+1)return;
    const attached=tabs.filter(t=>t.paperFront===front);if(!attached.length)return;
    movingPaper=front;appearance();
    // Desktop has two true paper faces. Mobile keeps its existing clipped single-page transition.
    if(single)return;
    for(const tab of attached)for(const side of ['front','back']){
      const surface=tab.node.cloneNode(true);surface.className='book-index-tab-turn';surface.removeAttribute('data-tab-id');surface.removeAttribute('aria-current');surface.setAttribute('aria-hidden','true');surface.tabIndex=-1;surface.disabled=true;surface.style.visibility='';surface.style.pointerEvents='none';
      surface.dataset.side=side==='front'?'right':'left';surface.style.left=side==='front'?'493px':`${7-tab.width}px`;
      sheet.querySelector(`.face.${side}`).append(surface);
    }
  });
  window.MissuBookAccessories={outset:Math.max(...config.tabs.map(t=>t.width-7))+7,get completed(){return completed;},get visitedPages(){return[...visited];},get targets(){return tabs.map(({id,label,date,page,paperFront,text,anchor,position,ranges})=>({id,label,date,page,paperFront,text,anchor,top:position,ranges}));}};
})();
