(() => {
  const $=id=>document.getElementById(id),{el,pageNode,coverNode}=WordRenderer;
  let layout,state=-1,single=false,busy=true,resizeTimer;
  const book=$('book'),viewport=$('viewport'),mode=$('mode');
  const editing=document.documentElement.dataset.view==='editor';
  function endSpread(){return single?layout.pages.length-1:Math.ceil(layout.pages.length/2);}
  function limit(){return endSpread()+1;}
  function visible(value=state){if(value<0||value>=limit())return{left:null,right:null};return single?{left:null,right:layout.pages[value]}:{left:value?layout.pages[value*2-1]:null,right:layout.pages[value*2]};}
  function backCoverNode(side='right'){
    const node=el('article',`hb-page hb-cover book-back-cover ${side}`);node.dataset.bookSurface='back-cover';node.setAttribute('aria-label','封底');
    if(WORD_LAYOUT_CONFIG.backCoverPath){node.style.backgroundImage=`url(${JSON.stringify(WORD_LAYOUT_CONFIG.backCoverPath)})`;node.style.backgroundSize='cover';node.style.backgroundPosition='center';}
    return node;
  }
  function innerBackNode(){const node=el('article','hb-page hb-cover book-inner-back right');node.dataset.bookSurface='inner-back-cover';node.setAttribute('aria-label','封底内侧');return node;}
  function innerFrontNode(){const node=el('article','hb-page hb-cover book-inner-front left');node.dataset.bookSurface='inner-front-cover';node.setAttribute('aria-label','封面内侧');return node;}
  function endPaperNode(){const node=el('article','hb-page book-endpaper left');node.dataset.bookSurface='endpaper';node.setAttribute('aria-label','封底内页');return node;}
  function slot(side,node,underlay=false){const n=el('div',`slot ${side}${underlay?' cover-underlay':''}`);n.append(node);book.append(n);}
  function putLeft(v,value){if(!single&&value>=0&&value<limit())slot('left',innerFrontNode(),true);if(v.left)slot('left',pageNode(v.left,'left'));else if(!single&&value===endSpread()&&layout.pages.length%2)slot('left',endPaperNode());}
  function putRight(v,value){if(v.right)slot('right',pageNode(v.right));else if(!single&&value===endSpread())slot('right',innerBackNode());}
  function render(value=state){book.replaceChildren();if(value<0){slot('right',coverNode());return;}if(value===limit()){slot(single?'right':'left',backCoverNode(single?'right':'left'));return;}const v=visible(value);putLeft(v,value);putRight(v,value);}
  function controls(){
    $('previous').disabled=busy||state<0;$('next').disabled=busy;mode.disabled=busy;$('jump').disabled=busy;$('regenerate').disabled=busy;$('export').disabled=busy;
    const closed=state===limit(),v=visible(),shown=[v.left,v.right].filter(Boolean);$('position').textContent=state<0?'封面':closed?'封底':shown.length?shown.map(p=>p.number).join(' – '):'封底内页';
    $('next').textContent=closed?'↻':'→';$('next').setAttribute('aria-label',closed?'翻回封面':'下一页');
    $('jump').value=state<0?'-1':closed?String(layout.pages.length):shown.length?String(shown[0].number-1):String(layout.pages.length+1);
    $('current-note').textContent=closed?'右箭头翻回封面，左箭头重新打开最后一页。':shown.map(p=>`${p.date} · ${p.category} · ${p.chars}字`).join('　 /　 ');
    document.querySelectorAll('.thumbnail').forEach((n,i)=>n.classList.toggle('active',shown.some(p=>p.number===i+1)));
    book.setAttribute('aria-busy',String(busy));
    document.dispatchEvent(new CustomEvent('missu-reading-state',{detail:{busy,single,state,cover:state<0,closed,pages:shown.map(p=>({number:p.number,date:p.date})),pageCount:layout.pages.length}}));
  }
  function fit(){
    const w=single?500:1000;
    const outset=window.MissuBookAccessories?.outset||0;
    const scale=Math.min(1,(innerWidth-(innerWidth<=760?24:56))/w,Math.max(400,innerHeight-155)/720,(innerWidth-16)/(w+2*outset));
    book.style.width=`${w}px`;book.style.height='720px';book.style.transform=`scale(${scale})`;
    viewport.style.width=`${w*scale}px`;viewport.style.height=`${720*scale}px`;
    viewport.style.left='0px';
    document.querySelectorAll('.thumb-frame').forEach(frame=>{frame.firstChild.style.transform=`scale(${frame.clientWidth/500})`;});
    document.dispatchEvent(new CustomEvent('missu-book-fit',{detail:{width:w,height:720,scale}}));
  }
  function pick(index,forceSingle=false){if(busy)return;if(forceSingle){single=true;mode.value='single';document.body.classList.add('single');}state=index<0?-1:index===layout.pages.length+1&&!single&&layout.pages.length%2?endSpread():index>=layout.pages.length?limit():single?index:Math.ceil(index/2);render();controls();fit();}
  function setMode(){if(busy)return;const page=visible().left||visible().right,anchor=state<0?-1:state===limit()?layout.pages.length:page?page.number-1:layout.pages.length-1;single=mode.value==='single';document.body.classList.toggle('single',single);pick(anchor);}
  async function turn(direction){
    if(busy)return;const wrap=state===limit()&&direction>0,target=wrap?-1:state+direction;if(target<-1||target>limit())return;
    document.dispatchEvent(new CustomEvent('missu-page-turn',{detail:{direction}}));
    busy=true;controls();const old=visible(),newer=visible(target);let front,back,reverse=direction<0;
    if(wrap){
      if(single){front=backCoverNode();back=coverNode();render(target);}else{front=coverNode();back=backCoverNode('left');book.replaceChildren();reverse=true;}
    }else if(single){
      const surface=value=>value<0?coverNode():value===limit()?backCoverNode():pageNode(layout.pages[value]);
      front=surface(direction>0?state:target);back=surface(direction>0?target:state);render(direction>0?target:state);
    }else if(target===limit()){
      front=innerBackNode();back=backCoverNode('left');book.replaceChildren();putLeft(old,state);
    }else if(state===limit()){
      front=innerBackNode();back=backCoverNode('left');book.replaceChildren();putLeft(newer,target);
    }else if(direction>0){
      front=state<0?coverNode():pageNode(layout.pages[state*2]);back=state<0?innerFrontNode():layout.pages[state*2+1]?pageNode(layout.pages[state*2+1],'left'):endPaperNode();book.replaceChildren();putLeft(old,state);putRight(newer,target);
    }else{
      front=target<0?coverNode():pageNode(layout.pages[target*2]);back=target<0?innerFrontNode():layout.pages[target*2+1]?pageNode(layout.pages[target*2+1],'left'):endPaperNode();book.replaceChildren();putLeft(newer,target);putRight(old,state);
    }
    const sheet=el('div','sheet'),f=el('div','face front'),b=el('div','face back');f.append(front);b.append(back);sheet.append(f,b);book.append(sheet);
    document.dispatchEvent(new CustomEvent('missu-sheet-created',{detail:{sheet,single}}));
    const forward=[{transform:'rotateY(0deg) skewY(0deg)'},{transform:'rotateY(-48deg) skewY(-1.3deg)',offset:.32},{transform:'rotateY(-112deg) skewY(1.2deg)',offset:.65},{transform:'rotateY(-180deg) skewY(0deg)'}];
    try{await sheet.animate(reverse?[...forward].reverse().map(({transform})=>({transform})):forward,{duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:DIARY_CONFIG.layout.turnDuration,easing:'cubic-bezier(.35,.02,.2,1)',fill:'forwards'}).finished;}
    finally{state=target;busy=false;render();controls();fit();}
  }
  function overview(){
    if(!editing)return;
    $('thumbnails').replaceChildren();$('source-notes').replaceChildren();
    const inventory=WORD_DIARY_DATA.formatInventory;
    const manualCount=WordPaginator.document.entries.filter(e=>e.layoutMode==='manual').length;
    $('source-notes').append(el('p','word-source-note',`已导入 ${WordPaginator.document.entries.length} 篇日记，其中 ${manualCount} 篇按 Word 人工版式还原；其他篇使用已保存的自动布局，并优先保留人工格式。`));
    layout.pages.forEach((p,i)=>{
      const button=el('button','thumbnail');button.setAttribute('aria-label',`单独查看第${i+1}页 ${p.date}`);
      const frame=el('div','thumb-frame');frame.append(pageNode(p));button.append(frame,el('span','caption',`${i+1} · ${p.date} · ${p.chars}字`));
      button.addEventListener('click',()=>{pick(i,true);viewport.scrollIntoView({behavior:'smooth',block:'start'});});$('thumbnails').append(button);
    });
  }
  function refreshJump(){
    $('jump').replaceChildren();const cover=el('option','','封面');cover.value=-1;$('jump').append(cover);
    layout.pages.forEach((p,i)=>{const option=el('option','',`${i+1} · ${p.date}`);option.value=i;$('jump').append(option);});
    const rear=el('option','','封底');rear.value=layout.pages.length;$('jump').append(rear);
    if(layout.pages.length%2){const inner=el('option','','封底内页');inner.value=layout.pages.length+1;$('jump').append(inner);}
  }
  function checkAndSet(candidate){WordPaginator.auditPages(candidate);const errors=WordRenderer.inspect(candidate);if(errors.length)throw Error(errors.join('；'));layout=candidate;refreshJump();state=Math.min(state,limit());overview();render();controls();fit();document.dispatchEvent(new Event('word-layout-updated'));}
  $('previous').addEventListener('click',()=>turn(-1));$('next').addEventListener('click',()=>turn(1));mode.addEventListener('change',setMode);
  $('jump').addEventListener('change',event=>pick(Number(event.target.value)));
  book.addEventListener('click',event=>{const rect=book.getBoundingClientRect();turn(state<0||state===limit()||event.clientX>=rect.left+rect.width/2?1:-1);});
  document.addEventListener('keydown',event=>{if(/INPUT|SELECT|TEXTAREA/.test(event.target.tagName)||event.ctrlKey||event.metaKey||event.altKey)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();turn(event.key==='ArrowRight'?1:-1);}});
  addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(innerWidth<=760&&!single&&!busy){mode.value='single';setMode();}fit();},150);});
  $('regenerate').addEventListener('click',async()=>{if(busy)return;busy=true;controls();try{const candidate=await WordPaginator.generate();busy=false;checkAndSet(candidate);$('error').hidden=true;}catch(error){showError(error);}finally{busy=false;controls();}});
  $('export').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(WordPaginator.document,null,2)],{type:'application/json'}));const link=el('a');link.href=url;link.download='missu-word-formatted.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  $('import').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{checkAndSet(await WordPaginator.generate(JSON.parse(await file.text())));$('error').hidden=true;}catch(error){showError(error);}event.target.value='';});
  function showError(error){$('error').hidden=false;$('error').textContent=error.message;console.error(error);}
  window.wordLayoutTest={get layout(){return layout;},get busy(){return busy;},get state(){return state;},get single(){return single;},get document(){return WordPaginator.document;},pick,generate:WordPaginator.generate,validate:WordPaginator.validateDocument,inspect:WordRenderer.inspect};
  function resolveAnchor(query){
    const anchor=WordPaginator.document.anchors.find(a=>a.id===query||a.lookupText===query||a.text===query);if(!anchor||!layout)return null;
    const ranges=anchor.ranges||[anchor];
    const pages=layout.pages.filter(p=>p.blocks.some(b=>ranges.some(r=>b.paragraphId===r.paragraphId&&b.end>r.start&&b.start<r.end))).map(p=>p.number);
    return{...anchor,pages};
  }
  window.missuDiary={get layout(){return layout;},get document(){return WordPaginator.document;},resolveAnchor,
    goToAnchor(query){const anchor=resolveAnchor(query);if(!anchor?.pages.length||busy)return false;pick(anchor.pages[0]-1);return true;}};
  async function init(){
    const font=new FontFace('字研室手帐体',`url("${WORD_LAYOUT_CONFIG.fontPath}")`,{ascentOverride:WORD_LAYOUT_CONFIG.fontMetrics.ascent,descentOverride:WORD_LAYOUT_CONFIG.fontMetrics.descent,lineGapOverride:WORD_LAYOUT_CONFIG.fontMetrics.lineGap});await font.load();document.fonts.add(font);await document.fonts.ready;
    layout=await WordPaginator.generate();single=innerWidth<=760;mode.value=single?'single':'spread';document.body.classList.toggle('single',single);
    layout.pages.forEach((p,i)=>{const option=el('option','',`${i+1} · ${p.date}`);option.value=i;$('jump').append(option);});
    busy=false;checkAndSet(layout);
  }
  init().catch(showError);
})();
