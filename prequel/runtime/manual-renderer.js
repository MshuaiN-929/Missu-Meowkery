(() => {
  const Base=WordRenderer,C=WORD_LAYOUT_CONFIG,baselineCache=new Map(),dashCache=new Map(),{el}=Base;
  function fontCSS(node,style,stroke=0){
    node.style.fontFamily=`"${style.font||C.autoDefaults.font}","Segoe UI Emoji","Microsoft YaHei",sans-serif`;
    node.style.fontSize=`${(style.fontSizePt??C.autoDefaults.fontSizePt)*4/3}px`;
    node.style.lineHeight='1';node.style.fontWeight=stroke?'400':style.b?'700':'400';
    node.style.color=style.color||C.autoDefaults.color;if(style.i)node.style.fontStyle='italic';
    if(stroke)node.style.webkitTextStroke=`${stroke}px ${style.color||C.autoDefaults.color}`;
  }
  function baselineOffset(style,stroke,text='猫'){
    const key=JSON.stringify([style.font,style.fontSizePt,style.b,style.i,stroke>0,text]);if(baselineCache.has(key))return baselineCache.get(key);
    const probe=el('span'),marker=el('i');probe.style.cssText='position:fixed;left:-10000px;top:0;white-space:nowrap;visibility:hidden';
    fontCSS(probe,style,stroke);probe.append(document.createTextNode(text));marker.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';probe.append(marker);document.body.append(probe);
    const offset=marker.getBoundingClientRect().top-probe.getBoundingClientRect().top;probe.remove();baselineCache.set(key,offset);return offset;
  }
  function dashMetrics(style,stroke){
    const key=JSON.stringify([style.font,style.fontSizePt,style.b,style.i,stroke>0,C.renderStyles.emDashFont,C.renderStyles.emDashAlignTo]);
    const displayStyle={...style,font:C.renderStyles.emDashFont};
    if(dashCache.has(key))return{...dashCache.get(key),style:displayStyle};
    const ctx=document.createElement('canvas').getContext('2d'),size=(style.fontSizePt??C.autoDefaults.fontSizePt)*4/3;
    const prefix=`${style.i?'italic':'normal'} ${stroke?'400':style.b?'700':'400'} ${size}px`;
    ctx.font=`${prefix} "${style.font||C.autoDefaults.font}",sans-serif`;
    const reference=ctx.measureText(C.renderStyles.emDashAlignTo||'一');
    ctx.font=`${prefix} "${C.renderStyles.emDashFont}",sans-serif`;
    const dash=ctx.measureText('—'),shift=(reference.actualBoundingBoxDescent-reference.actualBoundingBoxAscent-dash.actualBoundingBoxDescent+dash.actualBoundingBoxAscent)/2;
    const result={shift,width:dash.width};dashCache.set(key,result);return{...result,style:displayStyle};
  }
  function pageNode(page,side='right',documentData=WordPaginator.document){
    if(page.mode!=='manual'){
      const node=el('article',`hb-page ${side}`);node.dataset.page=page.number;node.dataset.date=page.date;const content=el('div','automatic-content');content.append(flowNode(page.blocks));node.append(content);return node;
    }
    const node=el('article',`hb-page ${side}`);node.dataset.page=page.number;node.dataset.date=page.date;
    const entry=documentData.entries.find(e=>e.id===page.entryId),paper=page.nativePaper||entry.manualLayout.nativePaper;
    const scale=Math.min(500/paper.width,720/paper.height),layer=el('div','manual-layer');
    layer.style.width=`${paper.width}px`;layer.style.height=`${paper.height}px`;layer.style.transform=`translate(${(500-paper.width*scale)/2}px,${(720-paper.height*scale)/2}px) scale(${scale})`;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('manual-decorations');svg.setAttribute('width',paper.width);svg.setAttribute('height',paper.height);svg.setAttribute('aria-hidden','true');
    for(const d of page.decorations){const rect=document.createElementNS(svg.namespaceURI,'rect');for(const key of ['x','y','width','height'])rect.setAttribute(key,d[key]);rect.setAttribute('fill',d.color);svg.append(rect);}layer.append(svg);
    const paragraphs=WordPaginator.paragraphIndex(documentData);
    for(const block of page.blocks){
      const source=paragraphs.get(block.paragraphId),p=el('p','manual-paragraph');p.dataset.sourceId=source.id;p.dataset.align=source.paragraphStyle.jc?.val||'left';
      const overrides=source.layout.overrides||{};if(overrides.rotation)p.style.transform=`rotate(${overrides.rotation}deg)`;
      for(const g of block.glyphs){
        const token=source.tokens[g.tokenIndex],style={...token.style,...overrides.runStyle,...token.overrides};
        const span=el('span',g.text==='\n'?'manual-control':'manual-glyph',g.text);span.dataset.sourceOffset=g.offset;span.dataset.tokenIndex=g.tokenIndex;span.dataset.baseline=g.baseline;
        span.style.left=`${g.x+(overrides.offsetX||0)}px`;
        if(g.text!=='\n'){
          if(style.font==='Segoe UI Emoji')span.classList.add('emoji');
          const dash=g.text==='—'&&C.renderStyles.emDashFont?dashMetrics(style,g.nativeStrokePx):null;
          const displayStyle=dash?.style||style;
          fontCSS(span,displayStyle,g.nativeStrokePx);span.style.top=`${g.baseline-baselineOffset(displayStyle,g.nativeStrokePx,dash?'—':'猫')+(overrides.offsetY||0)+(dash?.shift||0)}px`;
          if(dash){
            const scaleX=g.advance/dash.width;span.classList.add('corrected-em-dash');span.dataset.dashScaleX=scaleX;span.dataset.dashShiftY=dash.shift;
            span.style.transformOrigin='left top';span.style.transform=`scaleX(${scaleX})`;
          }
        }else span.style.top=`${g.baseline}px`;
        p.append(span);
      }layer.append(p);
    }node.append(layer);return node;
  }
  function inspect(layout,documentData=WordPaginator.document){
    const failures=[],canvas=document.createElement('canvas'),context=canvas.getContext('2d');
    for(const page of layout.pages)for(const side of ['left','right']){
      const node=pageNode(page,side,documentData);node.classList.add('word-inspection');document.body.append(node);const box=node.getBoundingClientRect();
      const inkBoxes=[];
      for(const span of node.querySelectorAll('.manual-glyph')){
        const r=span.getBoundingClientRect();if(r.left<box.left+40||r.right>box.right-40||r.top<box.top+45||r.bottom>box.bottom-45)failures.push(`第${page.number}页文字超出安全区域`);
        const s=getComputedStyle(span);context.font=`${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
        const metrics=context.measureText(span.textContent),layer=node.querySelector('.manual-layer'),layerBox=layer.getBoundingClientRect(),scale=layerBox.width/parseFloat(layer.style.width);
        const baseline=r.top+baselineOffset({font:s.fontFamily.split(',')[0].replaceAll('"',''),fontSizePt:parseFloat(s.fontSize)*3/4,b:s.fontWeight==='700',i:s.fontStyle==='italic'},parseFloat(s.webkitTextStrokeWidth)||0,span.classList.contains('corrected-em-dash')?'—':'猫')*scale;
        const glyphScale=Number(span.dataset.dashScaleX||1);
        const ink={left:r.left-metrics.actualBoundingBoxLeft*scale*glyphScale,right:r.left+metrics.actualBoundingBoxRight*scale*glyphScale,top:baseline-metrics.actualBoundingBoxAscent*scale,bottom:baseline+metrics.actualBoundingBoxDescent*scale,nativeBaseline:Number(span.dataset.baseline)};
        if(metrics.width&&span.textContent.trim())inkBoxes.push(ink);
      }
      for(let i=0;i<inkBoxes.length;i++)for(let j=0;j<i;j++){
        const a=inkBoxes[i],b=inkBoxes[j];if(Math.abs(a.nativeBaseline-b.nativeBaseline)>1&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>.8&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.8)failures.push(`第${page.number}页不同行的字形范围重叠，请在 Word 中调整或检查局部配置`);
      }
      if(page.mode==='automatic'){const body=node.querySelector('.automatic-content');if(body.firstChild.getBoundingClientRect().height>body.clientHeight+.5)failures.push('自动基础页内容溢出');}
      node.remove();
    }return [...new Set(failures)];
  }
  function flowNode(blocks){
    const flow=Base.flowNode(blocks),paragraphs=blocks.flatMap(b=>b.kind==='borderGroup'?b.paragraphs:[b.paragraph]);
    [...flow.querySelectorAll('.word-paragraph')].forEach((node,i)=>{
      const p=paragraphs[i],spacing=p.paragraphStyle.spacing||{},basePt=p.paragraphMarkStyle?.fontSizePt||C.autoDefaults.fontSizePt;
      if((spacing.lineRule||'auto')==='auto'){
        const gridPitch=Number(WORD_DIARY_DATA.wordSection.docGrid?.linePitch||0)/15;
        const snap=p.paragraphStyle.snapToGrid;
        const allowGrid=!snap||!['0','false','off'].includes(snap.val||'true');
        const natural=basePt*4/3*(922+410)/1024; // Provided font's OS/2 Win metrics.
        node.style.lineHeight=`${Math.max(natural,allowGrid?gridPitch:0)*Number(spacing.line||240)/240}px`;
      }
    });return flow;
  }
  function measure(blocks){const flow=flowNode(blocks);flow.classList.add('word-measure');document.body.append(flow);const h=flow.getBoundingClientRect().height;flow.remove();return h;}
  window.WordRenderer={...Base,pageNode,inspect,baselineOffset,flowNode,measure};
})();
