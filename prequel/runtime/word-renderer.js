(() => {
  const C=WORD_LAYOUT_CONFIG,el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const pxPt=n=>Number(n)*4/3,pxTwip=n=>Number(n)/15;
  const highlights={black:'#000000',blue:'#0000FF',cyan:'#00FFFF',green:'#00FF00',magenta:'#FF00FF',red:'#FF0000',yellow:'#FFFF00',white:'#FFFFFF',darkBlue:'#000080',darkCyan:'#008080',darkGreen:'#008000',darkMagenta:'#800080',darkRed:'#800000',darkYellow:'#808000',darkGray:'#808080',lightGray:'#C0C0C0',none:'transparent'};
  function border(side){
    const styles={single:'solid',double:'double',dotted:'dotted',dashed:'dashed',dashSmallGap:'dashed',nil:'none',none:'none'};
    return `${pxPt(Number(side.sz||4)/8)}px ${styles[side.val]||'solid'} ${side.color&&side.color!=='auto'?'#'+side.color:C.automaticBorderColor}`;
  }
  function runStyle(node,style){
    node.style.fontFamily=`"${style.font||C.autoDefaults.font}", "Segoe UI Emoji", "Microsoft YaHei", sans-serif`;
    node.style.fontSize=`${pxPt(style.fontSizePt??C.autoDefaults.fontSizePt)}px`;
    if(style.color)node.style.color=style.color;
    node.style.fontWeight=style.b?'700':'400';if(style.i)node.style.fontStyle='italic';
    const decorations=[];
    if(style.u&&style.u.val!=='none')decorations.push('underline');
    if(style.strike||style.dstrike)decorations.push('line-through');
    if(decorations.length){node.style.textDecorationLine=decorations.join(' ');node.style.textDecorationStyle=style.dstrike||style.u?.val==='double'?'double':style.u?.val?.includes('wave')?'wavy':style.u?.val==='dotted'?'dotted':style.u?.val?.includes('dash')?'dashed':'solid';if(style.u?.color&&style.u.color!=='auto')node.style.textDecorationColor='#'+style.u.color;}
    if(style.shd?.fill&&style.shd.fill!=='auto')node.style.backgroundColor='#'+style.shd.fill;
    if(style.highlight&&highlights[style.highlight.val])node.style.backgroundColor=highlights[style.highlight.val];
    if(style.spacing)node.style.letterSpacing=`${pxTwip(style.spacing.val)}px`;
    if(style.vertAlign?.val==='superscript')node.style.verticalAlign='super';if(style.vertAlign?.val==='subscript')node.style.verticalAlign='sub';
    if(style.position){node.style.position='relative';node.style.top=`${-pxPt(Number(style.position.val)/2)}px`;}
    if(style.caps)node.style.textTransform='uppercase';if(style.smallCaps)node.style.fontVariant='small-caps';
  }
  function paragraphNode(p,inBorder=false){
    const node=el('p','word-paragraph');node.dataset.sourceId=p.id;node.dataset.fragmentStart=p.fragmentStart??0;node.dataset.fragmentEnd=p.fragmentEnd??Array.from(p.text).length;
    const props={...p.paragraphStyle,...p.layout.overrides.paragraphStyle},space=props.spacing||{},indent=props.ind||{};
    const base=p.paragraphMarkStyle||p.tokens[0]?.style||C.autoDefaults;
    runStyle(node,base);
    const override=p.layout.overrides;
    const align=override.align||props.jc?.val||C.autoDefaults.align;
    node.style.textAlign={both:'justify',distribute:'justify',start:'left',end:'right'}[align]||align;
    node.style.marginTop=`${p.isSplitContinuation?0:pxTwip(space.before||0)}px`;
    node.style.marginBottom=`${p.isSplitBeforeEnd?0:pxTwip(space.after||0)}px`;
    node.style.marginLeft=`${inBorder?0:pxTwip(indent.left||indent.start||0)}px`;
    node.style.marginRight=`${inBorder?0:pxTwip(indent.right||indent.end||0)}px`;
    node.style.textIndent=indent.firstLineChars?`${Number(indent.firstLineChars)/100}em`:indent.hangingChars?`${-Number(indent.hangingChars)/100}em`:`${pxTwip(Number(indent.firstLine||0)-Number(indent.hanging||0))}px`;
    const line=Number(space.line||240),rule=space.lineRule||'auto';
    node.style.lineHeight=rule==='auto'?String(line/240):`${pxTwip(line)}px`;
    if(rule==='atLeast')node.style.lineHeight=`max(${pxTwip(line)}px,1.2em)`;
    if(!p.text)node.style.minHeight=rule==='exact'?`${pxTwip(line)}px`:`${pxPt(base.fontSizePt||11)*(rule==='auto'?line/240:1.2)}px`;
    if(props.shd?.fill&&props.shd.fill!=='auto')node.style.backgroundColor='#'+props.shd.fill;
    if(override.offsetX)node.style.position='relative',node.style.left=`${override.offsetX}px`;
    if(override.rotation)node.style.transform=`rotate(${override.rotation}deg)`;
    for(let index=0;index<p.tokens.length;index++){
      const token=p.tokens[index],span=el('span','word-token',token.text);span.dataset.tokenIndex=index;span.dataset.sourceStart=token.start;span.dataset.sourceEnd=token.end;
      runStyle(span,{...token.style,...override.runStyle,...token.overrides});node.append(span);
    }
    return node;
  }
  function flowNode(blocks){
    const flow=el('div','word-flow');
    for(const block of blocks){
      if(block.kind==='borderGroup'){
        const group=el('div','word-border-group'),first=block.paragraphs[0],borderProps=first.paragraphStyle.pBdr.children;
        const ind=first.paragraphStyle.ind||{};group.style.marginLeft=`${pxTwip(ind.left||0)}px`;group.style.marginRight=`${pxTwip(ind.right||0)}px`;
        for(const side of ['top','right','bottom','left'])if(borderProps[side]){group.style[`border${side[0].toUpperCase()+side.slice(1)}`]=border(borderProps[side]);group.style[`padding${side[0].toUpperCase()+side.slice(1)}`]=`${pxPt(borderProps[side].space||0)}px`;}
        block.paragraphs.forEach(p=>group.append(paragraphNode(p,true)));flow.append(group);
      }else flow.append(paragraphNode(block.paragraph));
    }
    return flow;
  }
  function pageNode(page,side='right'){
    const node=el('article',`hb-page ${side}`);node.dataset.page=page.number;node.dataset.date=page.date;
    const content=el('div',`word-content${page.continued?' continued':''}`);content.append(flowNode(page.blocks));node.append(content);
    if(page.continued)node.append(el('div','word-continuation',page.date));
    node.append(el('span','hb-number',String(page.number)));return node;
  }
  function coverNode(){const node=el('article','hb-page hb-cover');node.append(el('h1','','米酥日记'),el('p','','Missu'));return node;}
  function measure(blocks){const flow=flowNode(blocks);flow.classList.add('word-measure');document.body.append(flow);const h=flow.getBoundingClientRect().height;flow.remove();return h;}
  function inspect(layout){
    const errors=[];
    for(const page of layout.pages)for(const side of ['left','right']){
      const node=pageNode(page,side);node.classList.add('word-inspection');document.body.append(node);
      const content=node.querySelector('.word-content'),box=content.getBoundingClientRect();
      if(content.firstChild.getBoundingClientRect().height>box.height+.5)errors.push(`第${page.number}页正文高度溢出`);
      const rects=[];
      for(const p of content.querySelectorAll('.word-paragraph')){
        const b=p.getBoundingClientRect();if(b.left<box.left-1||b.right>box.right+1||b.bottom>box.bottom+1||b.top<box.top-1||p.scrollWidth>p.clientWidth+1)errors.push(`第${page.number}页 ${p.dataset.sourceId} 超出安全区`);
        for(const prior of rects)if(b.top<prior.bottom-.5&&b.bottom>prior.top+.5&&b.left<prior.right&&b.right>prior.left)errors.push(`第${page.number}页段落重叠`);rects.push(b);
        // Test the actual text line boxes as well as paragraph containers.
        for(const token of p.querySelectorAll('.word-token'))for(const r of token.getClientRects())if(r.left<box.left-1||r.right>box.right+1||r.bottom>box.bottom+2||r.top<box.top-2)errors.push(`第${page.number}页字形行框超出安全区`);
      }
      node.remove();
    }
    return [...new Set(errors)];
  }
  window.WordRenderer={el,pageNode,coverNode,paragraphNode,flowNode,measure,inspect};
})();
