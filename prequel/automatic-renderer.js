(() => {
  const Base=WordRenderer,C=WORD_LAYOUT_CONFIG,NS='http://www.w3.org/2000/svg',cp=s=>Array.from(s);
  const effectiveStyle=(token,b,offset=token.start)=>FullDiaryAnalyzer.effectiveStyle(token,b,offset);
  function textStyle(node,s){
    node.style.fontFamily=`"${s.font}","Segoe UI Emoji","Microsoft YaHei",sans-serif`;
    if(s.font==='Segoe UI Emoji')node.style.fontVariantEmoji='text';
    node.style.fontSize=`${s.fontSizePt*4/3}px`;node.style.color=s.color||C.autoDefaults.color;
    node.style.fontWeight=s.b?'700':'400';if(s.i)node.style.fontStyle='italic';
    if(s.strike||s.dstrike){node.style.textDecorationLine='line-through';node.style.textDecorationStyle=s.dstrike?'double':'solid';}
    if(s.shd?.fill&&s.shd.fill!=='auto')node.style.backgroundColor='#'+s.shd.fill;
    if(s.highlight?.val==='cyan')node.style.backgroundColor=C.renderStyles.highlightPalette[0];
    else if(s.highlight?.val&&s.highlight.val!=='none')node.style.backgroundColor=({yellow:'#F5E6AD',green:'#DCE6ED',blue:'#DCE6ED'})[s.highlight.val]||'#F5E6AD';
    if(s.spacing)node.style.letterSpacing=`${Number(s.spacing.val)/15}px`;
    if(s.vertAlign?.val==='superscript')node.style.verticalAlign='super';if(s.vertAlign?.val==='subscript')node.style.verticalAlign='sub';
    if(s.position)node.style.position='relative',node.style.top=`${-Number(s.position.val)*2/3}px`;
    if(s.caps)node.style.textTransform='uppercase';if(s.smallCaps)node.style.fontVariant='small-caps';
  }
  function blockNode(b,data){
    const p=WordPaginator.paragraphIndex(data).get(b.paragraphId),node=Base.el('div','auto-block');
    node.dataset.sourceId=p.id;node.dataset.fragmentStart=b.start;node.dataset.fragmentEnd=b.end;node.dataset.type=b.type;
    const props=p.paragraphStyle,space=props.spacing||{},ind=props.ind||{};
    node.style.width=`${b.width}px`;node.style.whiteSpace='pre-wrap';node.style.overflowWrap='normal';node.style.wordBreak='normal';node.style.lineBreak='strict';
    node.style.fontFamily='"字研室手帐体",sans-serif';node.style.fontSize=`${b.automatic.fontSizePt*4/3}px`;
    const largest=Math.max(b.automatic.fontSizePt,...FullDiaryAnalyzer.sliceTokens(p,b.start,b.end).map(t=>effectiveStyle(t,b).fontSizePt));
    const lineRule=space.lineRule||'auto',pitch=Number(data.wordSection.docGrid?.linePitch||312)/15;
    node.style.lineHeight=lineRule==='exact'?`${Number(space.line)/15}px`:lineRule==='atLeast'?`${Math.max(Number(space.line)/15,largest*4/3*1.3)}px`:`${Math.max(pitch,largest*4/3*(922+410)/1024)*Number(space.line||240)/240}px`;
    node.style.textAlign={both:'justify',distribute:'justify'}[b.automatic.align]||b.automatic.align;
    node.style.paddingLeft=`${Number(ind.left||ind.start||0)/15}px`;node.style.paddingRight=`${Number(ind.right||ind.end||0)/15}px`;
    node.style.textIndent=ind.firstLineChars?`${Number(ind.firstLineChars)/100}em`:ind.hangingChars?`${-Number(ind.hangingChars)/100}em`:ind.firstLine||ind.hanging?`${(Number(ind.firstLine||0)-Number(ind.hanging||0))/15}px`:b.automatic.indent||'0';
    if(b.start>0&&!b.manual?.paragraphProperties.ind)node.style.textIndent=b.automatic.indent||'0';
    node.style.paddingTop=`${b.start===0?Number(space.before||0)/15:0}px`;
    node.style.paddingBottom=`${b.end===cp(p.text).length?Number(space.after||0)/15:0}px`;
    if(props.shd?.fill&&props.shd.fill!=='auto')node.style.backgroundColor='#'+props.shd.fill;
    if(props.pBdr){node.classList.add('auto-bordered');node.style.padding='7px 9px';}
    for(const token of FullDiaryAnalyzer.sliceTokens(p,b.start,b.end)){
      const cuts=[...new Set([token.start,token.end,...[...b.marks,...(b.emphasis||[])].flatMap(m=>[m.start,m.end]).filter(x=>x>token.start&&x<token.end)])].sort((a,b)=>a-b);
      for(let i=0;i<cuts.length-1;i++){
        const from=cuts[i],to=cuts[i+1],span=Base.el('span','auto-token',cp(p.text).slice(from,to).join(''));
        span.dataset.sourceStart=from;span.dataset.sourceEnd=to;span.dataset.tokenIndex=p.tokens.indexOf(p.tokens.find(t=>t.start<=from&&t.end>from));
        const s=effectiveStyle(token,b,from);textStyle(span,s);
        if(s.u&&s.u.val!=='none')span.dataset.underlined='true';
        const mark=b.marks.find(m=>m.kind==='highlight'&&from>=m.start&&to<=m.end);if(mark)span.style.backgroundColor=mark.color;
        node.append(span);
      }
    }
    if(b.type==='blank')node.style.minHeight=`${b.trailingBlank?0:parseFloat(node.style.lineHeight)}px`;
    if(b.trailingBlank)node.style.padding='0',node.style.height='0',node.style.overflow='hidden';
    return node;
  }
  function measureBlock(b,data){
    const node=blockNode(b,data);node.style.position='fixed';node.style.left='-10000px';node.style.top='0';node.style.visibility='hidden';document.body.append(node);
    const height=node.getBoundingClientRect().height;node.remove();return height;
  }
  function waves(box){
    const a=C.renderStyles.underlineAmplitude,y=box.y+box.height/2+a,n=Math.max(2,Math.round(box.width/(C.renderStyles.underlineWavelength/2))),step=box.width/n;
    let d=`M ${box.x} ${y}`;for(let i=0;i<n;i++){const x=box.x+i*step,bend=a*4/3*(i%2?-1:1);d+=` C ${x+step/3} ${y+bend} ${x+step*2/3} ${y+bend} ${x+step} ${y}`;}return d;
  }
  function path(svg,d,color,weight,cls){const p=document.createElementNS(NS,'path');p.classList.add(cls);p.setAttribute('d',d);p.setAttribute('fill','none');p.setAttribute('stroke',color);p.setAttribute('stroke-width',weight);p.setAttribute('stroke-linejoin','round');svg.append(p);return p;}
  function addMarks(node){
    const box=node.getBoundingClientRect(),scale=box.width/500,svg=node.querySelector('.auto-decorations');
    const lines=[];
    for(const token of node.querySelectorAll('[data-underlined]')){
      const range=document.createRange();range.selectNodeContents(token);
      for(const r of range.getClientRects()){
        if(r.width<1||r.height<2)continue;
        const line={x:(r.left-box.left)/scale,y:(r.bottom-box.top)/scale+1.4,width:r.width/scale,height:.8,color:getComputedStyle(token).color};
        const old=lines.find(p=>Math.abs(p.y-line.y)<1&&p.color===line.color&&Math.abs(p.x+p.width-line.x)<2);
        if(old)old.width=line.x+line.width-old.x;else lines.push(line);
      }
    }
    lines.forEach(line=>path(svg,waves(line),line.color,line.height,'hand-underline'));
    for(const block of node.querySelectorAll('.auto-bordered')){
      const r=block.getBoundingClientRect(),x=(r.left-box.left)/scale,y=(r.top-box.top)/scale,w=r.width/scale,h=r.height/scale;
      path(svg,`M ${x+.5} ${y+1} C ${x+w*.25} ${y+3} ${x+w*.6} ${y+.5} ${x+w-.5} ${y+1.5} C ${x+w-2} ${y+h*.35} ${x+w-.5} ${y+h*.7} ${x+w-1} ${y+h-1} C ${x+w*.65} ${y+h-3} ${x+w*.3} ${y+h-.5} ${x+1} ${y+h-1.5} C ${x+3} ${y+h*.7} ${x+.5} ${y+h*.3} ${x+.5} ${y+1} Z`,C.renderStyles.borderColor,C.renderStyles.borderStroke,'hand-list-border');
    }
  }
  function pageNode(page,side='right',data=WordPaginator.document){
    if(page.mode==='manual')return Base.pageNode(page,side,data);
    const node=Base.el('article',`hb-page ${side}`);node.dataset.page=page.number;node.dataset.date=page.date;
    for(const b of page.blocks){
      let block;
      if(b.glyphs){
        block=Base.el('div','auto-block');block.dataset.sourceId=b.paragraphId;block.dataset.fragmentStart=b.start;block.dataset.fragmentEnd=b.end;block.dataset.type=b.type;
        block.style.width=`${b.width}px`;block.style.height=`${b.height}px`;
        if(WordPaginator.paragraphIndex(data).get(b.paragraphId).paragraphStyle.pBdr)block.classList.add('auto-bordered');
        for(const g of b.glyphs){
          const control=g.text==='\n'||b.trailingBlank,span=Base.el('span',control?'auto-control':'auto-token auto-glyph',g.text);
          span.dataset.sourceStart=g.start;span.dataset.sourceEnd=g.end;span.dataset.tokenIndex=g.tokenIndex;
          span.style.left=`${g.x}px`;
          if(!control){
            const style=g.style||b.styles[g.styleIndex];
            textStyle(span,style);span.style.top=`${g.baseline-Base.baselineOffset(style,0)}px`;
            span.style.width=`${g.advance}px`;
            const mark=b.marks.find(m=>m.kind==='highlight'&&g.start>=m.start&&g.end<=m.end);if(mark)span.style.backgroundColor=mark.color;
          }else span.style.top='0';
          block.append(span);
        }
      }else block=blockNode(b,data);
      block.style.position='absolute';block.style.left=`${b.x}px`;block.style.top=`${b.y}px`;if(b.automatic.rotation)block.style.transform=`rotate(${b.automatic.rotation}deg)`;node.append(block);
    }
    if(page.continued){const date=Base.el('div','auto-continuation',page.date);node.append(date);}
    const svg=document.createElementNS(NS,'svg');svg.classList.add('auto-decorations');svg.setAttribute('width',500);svg.setAttribute('height',720);svg.setAttribute('aria-hidden','true');node.append(svg);
    if(page.blocks.every(b=>b.glyphs)){
      const lines=[];
      for(const b of page.blocks){
        for(const g of b.glyphs){
          if(!g.ink)continue;const style=g.style||b.styles[g.styleIndex];
          const automaticUnderline=b.marks.some(m=>m.kind==='underline'&&g.start>=m.start&&g.end<=m.end);
          if((!style.u||style.u.val==='none')&&!automaticUnderline)continue;
          const key=`${b.paragraphId}:${b.start}:${g.line}`,last=lines.at(-1),left=b.x+g.x,right=left+g.advance,bottom=b.y+g.ink.bottom;
          if(last?.key===key&&last.color===style.color&&Math.abs(last.x+last.width-left)<1){last.width=right-last.x;last.y=Math.max(last.y,bottom+1.2);}
          else lines.push({key,x:left,y:bottom+1.2,width:g.advance,height:.8,color:style.color});
        }
      }lines.forEach(line=>path(svg,waves(line),line.color,line.height,'hand-underline'));
      for(const b of page.blocks.filter(b=>WordPaginator.paragraphIndex(data).get(b.paragraphId).paragraphStyle.pBdr)){
        const{x,y,width:w,height:h}=b;
        path(svg,`M ${x+.5} ${y+1} C ${x+w*.25} ${y+3} ${x+w*.6} ${y+.5} ${x+w-.5} ${y+1.5} C ${x+w-2} ${y+h*.35} ${x+w-.5} ${y+h*.7} ${x+w-1} ${y+h-1} C ${x+w*.65} ${y+h-3} ${x+w*.3} ${y+h-.5} ${x+1} ${y+h-1.5} C ${x+3} ${y+h*.7} ${x+.5} ${y+h*.3} ${x+.5} ${y+1} Z`,C.renderStyles.borderColor,C.renderStyles.borderStroke,'hand-list-border');
      }
    }else node.updateMarks=()=>{if(!node.isConnected||node.getBoundingClientRect().width===0)return;svg.replaceChildren();addMarks(node);};return node;
  }
  // Marks require real line boxes: populate on insertion, rather than guessing widths.
  const observer=new MutationObserver(records=>{for(const record of records)for(const added of record.addedNodes)if(added.nodeType===1){if(added.updateMarks)added.updateMarks();for(const p of added.querySelectorAll?.('.hb-page')||[])if(p.updateMarks)p.updateMarks();}});
  observer.observe(document.body,{childList:true,subtree:true});
  function inspect(layout,data=WordPaginator.document){
    const failures=Base.inspect({...layout,pages:layout.pages.filter(p=>p.mode==='manual')},data);
    for(const page of layout.pages.filter(p=>p.mode==='automatic')){
      const node=pageNode(page,'right',data);node.classList.add('word-inspection');document.body.append(node);const prior=[];
      for(const b of page.blocks){
        const p=node.querySelector(`[data-source-id="${b.paragraphId}"][data-fragment-start="${b.start}"]`),r=p.getBoundingClientRect(),box=node.getBoundingClientRect();
        if(!b.trailingBlank&&(r.left<box.left+40-.1||r.right>box.right-40+.1||r.top<box.top+45-.1||r.bottom>box.bottom-45+.1))failures.push(`第${page.number}页文字块超出安全区`);
        if(r.height&&prior.some(q=>r.top<q.bottom-.1&&r.bottom>q.top+.1))failures.push(`第${page.number}页文字块重叠`);prior.push(r);
        for(const token of p.querySelectorAll('.auto-token'))for(const t of token.getClientRects())if(t.width>0&&(t.left<box.left+40-1||t.right>box.right-40+1||t.bottom>box.bottom-45+1))failures.push(`第${page.number}页文字超出安全区`);
      }node.remove();
    }return[...new Set(failures)];
  }
  window.WordRenderer={...Base,pageNode,inspect,measureBlock,blockNode,effectiveStyle};
})();
