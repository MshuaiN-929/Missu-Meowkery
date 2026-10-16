(() => {
  const C=WORD_LAYOUT_CONFIG,cp=s=>Array.from(s),clone=x=>structuredClone(x);let data=WORD_DIARY_DATA;
  const paragraphIndex=(d=data)=>new Map(d.entries.flatMap(e=>e.paragraphs).map(p=>[p.id,p]));
  function auditPages(layout,d=data){
    const collected=new Map([...paragraphIndex(d)].map(([id])=>[id,[]])),order=[];
    for(const page of layout.pages){let body='';for(const b of page.blocks){
      const p=paragraphIndex(d).get(b.paragraphId),part=cp(p.text).slice(b.start,b.end).join('');
      if(b.kind==='manualParagraph'&&b.glyphs.map(g=>g.text).join('')!==part)throw Error('已确认书页原文改变');
      collected.get(p.id).push({start:b.start,end:b.end,text:part,page:page.number});if(order.at(-1)!==p.id)order.push(p.id);body+=part;
    }if(!body.trim()||!page.blocks.some(b=>b.type!=='date'&&cp(paragraphIndex(d).get(b.paragraphId).text).slice(b.start,b.end).join('').trim()))throw Error('无意义空白续页');}
    if(JSON.stringify(order)!==JSON.stringify([...paragraphIndex(d).keys()]))throw Error('原文顺序改变');
    for(const [id,p] of paragraphIndex(d)){let offset=0;for(const b of collected.get(id)){if(b.start!==offset)throw Error('文字遗漏或重复');offset=b.end;}if(collected.get(id).map(b=>b.text).join('')!==p.text)throw Error('原文不一致');}
    for(const entry of d.entries)for(const p of entry.paragraphs)for(const br of (p.breaks||[]).filter(b=>b.explicit&&b.kind==='page')){
      const before=collected.get(p.id).filter(b=>b.end<=br.offset&&b.end>b.start).at(-1),after=collected.get(p.id).find(b=>b.start>=br.offset&&b.end>b.start);
      if(before&&after&&before.page===after.page)throw Error('手动分页未保留');
    }
  }
  function validateDocument(candidate){
    if(candidate.entries.length!==27)throw Error('日期数量不正确');
    const original=WORD_DIARY_DATA.entries,actual=candidate.entries;
    actual.forEach((e,i)=>{if(e.date!==original[i].date)throw Error('日期顺序改变');if(JSON.stringify(e.paragraphs.map(p=>[p.id,p.text]))!==JSON.stringify(original[i].paragraphs.map(p=>[p.id,p.text])))throw Error('原文不能通过排版配置更改');if(i<5&&JSON.stringify(e)!==JSON.stringify(original[i]))throw Error('已确认的五篇已封存；请先单独对照审核');});
  }
  function automatic(entry,d,start){
    const units=FullDiaryAnalyzer.analyze(entry),pages=[];let blocks=[],y=C.paper.top,body=false;
    function flush(){if(body){pages.push({number:start+pages.length,date:entry.date,entryId:entry.id,continued:pages.length>0,mode:'automatic',category:'自动基础排版 · Word格式优先',blocks,chars:blocks.reduce((n,b)=>n+b.end-b.start,0)});blocks=[];y=C.paper.top;body=false;}}
    for(let i=0;i<units.length;i++){
      let b=units[i];if(b.kind==='break'){flush();continue;}
      if(b.breakBefore)flush();const p=paragraphIndex(d).get(b.paragraphId),text=cp(p.text).slice(b.start,b.end).join('');
      const more=units.slice(i+1).some(u=>u.kind!=='break'&&cp(paragraphIndex(d).get(u.paragraphId).text).slice(u.start,u.end).join('').trim());
      if(b.type==='blank'&&!more)b.trailingBlank=true;
      b.x=C.paper.inner+b.automatic.inset;b.width=C.paper.width-b.x-C.paper.outer;
      b.height=WordRenderer.measureBlock(b,d);
      if(b.trailingBlank&&!body&&pages.length){const last=pages.at(-1);b.y=Math.min(C.paper.height-C.paper.bottom,last.blocks.at(-1).y+last.blocks.at(-1).height);last.blocks.push(b);last.chars+=b.end-b.start;continue;}
      const gap=blocks.length&&b.type!=='blank'?blocks.at(-1).type==='date'?20:b.automatic.gapBefore:0;
      if(y+gap+b.height>C.paper.height-C.paper.bottom&&body)flush();
      if(b.height>C.paper.height-C.paper.top-C.paper.bottom)throw Error(`原文块过长，须拆分自然句边界：${p.id}`);
      b.y=y+(blocks.length&&b.type!=='blank'?blocks.at(-1).type==='date'?20:b.automatic.gapBefore:0);y=b.y+b.height;blocks.push(b);
      if(text.trim()&&b.type!=='date')body=true;
    }flush();return pages;
  }
  function assemble(candidate){
    const pages=[];
    for(const entry of candidate.entries){
      const entryPages=entry.layoutMode==='manual'?entry.manualLayout.pages:entry.autoLayout?.pages||automatic(entry,candidate,pages.length+1);
      if(entry.layoutMode==='automatic'&&!entry.autoLayout)entry.autoLayout={schemaVersion:2,rulesVersion:'full-diary-2-semantic',pages:clone(entryPages)};
      for(const p of entryPages)pages.push({...clone(p),number:pages.length+1,...(entry.layoutMode==='manual'?{nativePaper:entry.manualLayout.nativePaper}:{})});
    }return{schemaVersion:2,source:candidate.source,paper:C.paper,anchors:candidate.anchors,pages};
  }
  async function generate(candidate=data){validateDocument(candidate);const layout=assemble(candidate);auditPages(layout,candidate);const errors=WordRenderer.inspect(layout,candidate);if(errors.length)throw Error(errors.join('；'));data=candidate;return layout;}
  window.WordPaginator={paragraphIndex,auditPages,validateDocument,assemble,generate,get document(){return data;}};
})();
