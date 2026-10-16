// Render-only adaptation. Source formats, text coordinates and pagination stay intact.
(() => {
  const Base=WordRenderer,NS='http://www.w3.org/2000/svg';
  function highlightGroups(data){
    const groups=[];let cyanIndex=0;
    for(const entry of data.entries)for(const p of entry.paragraphs){
      let active;
      for(const token of p.tokens){
        const highlight=token.style.highlight?.val;
        const afterApprovedSamples=entry.date.split('.').reduce((key,n)=>key*100+Number(n),0)>20260523;
        if(highlight==='cyan'||highlight==='yellow'&&afterApprovedSamples){
          if(active&&active.end===token.start&&active.highlight===highlight)active.end=token.end;
          else{active={paragraphId:p.id,start:token.start,end:token.end,highlight,index:highlight==='cyan'?cyanIndex++:0};groups.push(active);}
        }else active=null;
      }
    }return groups;
  }
  function borderGeometry(page,data){
    const map=WordPaginator.paragraphIndex(data);
    if(!page.blocks.some(b=>map.get(b.paragraphId)?.paragraphStyle.pBdr))return null;
    const glyphs=page.blocks.filter(b=>map.get(b.paragraphId)?.paragraphStyle.pBdr).flatMap(b=>b.glyphs);
    const borderParagraph=map.get(page.blocks.find(b=>map.get(b.paragraphId)?.paragraphStyle.pBdr).paragraphId);
    const rightPadding=Number(borderParagraph.paragraphStyle.pBdr.children.right?.space||0)*4/3;
    const left=Math.min(...glyphs.map(g=>g.x))-12,right=Number(data.wordSection.pgSz.w)/15-Number(data.wordSection.pgMar.right)/15+rightPadding+4;
    const top=Math.min(...glyphs.map(g=>g.baseline))-30,bottom=Math.max(...glyphs.map(g=>g.baseline))+20;
    const candidates=page.decorations.map((d,index)=>({...d,index})).filter(d=>d.color.toLowerCase()==='#000000'&&Math.min(d.width,d.height)<1.5&&d.x>=left&&d.x+d.width<=right&&d.y>=top&&d.y+d.height<=bottom);
    if(!candidates.length)return null;
    const x=Math.min(...candidates.map(d=>d.x)),y=Math.min(...candidates.map(d=>d.y));
    const width=Math.max(...candidates.map(d=>d.x+d.width))-x,height=Math.max(...candidates.map(d=>d.y+d.height))-y;
    const perimeter=candidates.filter(d=>d.width<1.5&&(Math.abs(d.x-x)<1||Math.abs(d.x+d.width-x-width)<1)||d.height<1.5&&(Math.abs(d.y-y)<1||Math.abs(d.y+d.height-y-height)<1));
    return{x,y,width,height,indices:perimeter.map(d=>d.index)};
  }
  function framePath(box){
    const inset=WORD_LAYOUT_CONFIG.renderStyles.borderStroke/2;
    const x=box.x+inset,y=box.y+inset,w=box.width-inset*2,h=box.height-inset*2,r=x+w,b=y+h,j=WORD_LAYOUT_CONFIG.renderStyles.borderWobble;
    // A repeatable pen trajectory with rounded turns; all points stay in the old frame.
    const points=[[x+3,y+1.1],[x+w*.18,y+j*.75],[x+w*.43,y],[x+w*.69,y+j*.58],[r-3,y+j*.3],
      [r-j*.3,y+3],[r-j*.85,y+h*.25],[r,y+h*.49],[r-j*.65,y+h*.77],[r-1,b-3],
      [r-4,b-j*.45],[x+w*.78,b-j*.85],[x+w*.53,b],[x+w*.25,b-j*.66],[x+3,b-j*.2],
      [x+j*.25,b-3],[x+j*.9,y+h*.75],[x,y+h*.49],[x+j*.6,y+h*.24],[x+1,y+3]];
    const clamp=p=>[Math.max(x,Math.min(r,p[0])),Math.max(y,Math.min(b,p[1]))];
    let path=`M ${points[0].join(' ')}`;
    points.forEach((p,i)=>{
      const prev=points[(i+points.length-1)%points.length],next=points[(i+1)%points.length],after=points[(i+2)%points.length];
      const c1=clamp([p[0]+(next[0]-prev[0])/6,p[1]+(next[1]-prev[1])/6]);
      const c2=clamp([next[0]-(after[0]-p[0])/6,next[1]-(after[1]-p[1])/6]);
      path+=` C ${c1.join(' ')} ${c2.join(' ')} ${next.join(' ')}`;
    });return path+' Z';
  }
  function underlineGeometry(page,data,border=borderGeometry(page,data)){
    const map=WordPaginator.paragraphIndex(data),marks=[];
    page.decorations.forEach((d,index)=>{
      if(d.height>=1.5||d.width<=1.5||border?.indices.includes(index))return;
      const glyphs=page.blocks.flatMap(b=>b.glyphs).filter(g=>{
        const style=map.get(g.paragraphId).tokens[g.tokenIndex].style;
        return style.u&&style.u.val!=='none'&&g.text!=='\n'&&g.x+g.advance/2>=d.x-.5&&g.x+g.advance/2<=d.x+d.width+.5&&d.y-g.baseline>=-1&&d.y-g.baseline<=Math.max(4,style.fontSizePt*4/3*.35);
      });
      if(!glyphs.length)return;
      const ranges=[];
      for(const g of glyphs){const last=ranges.at(-1);if(last?.paragraphId===g.paragraphId&&last.end===g.offset)last.end++;else ranges.push({paragraphId:g.paragraphId,start:g.offset,end:g.offset+1});}
      marks.push({...d,index,ranges});
    });return marks;
  }
  function underlinePath(mark){
    const {underlineAmplitude:amplitude,underlineWavelength:wavelength}=WORD_LAYOUT_CONFIG.renderStyles;
    // Waves bend downward from Word's line, so they cannot creep into the lettering.
    const y=mark.y+mark.height/2+amplitude,halfWaves=Math.max(2,Math.round(mark.width/(wavelength/2))),step=mark.width/halfWaves;
    let path=`M ${mark.x} ${y}`;
    for(let i=0;i<halfWaves;i++){
      const x=mark.x+i*step,bend=amplitude*4/3*(i%2?-1:1);
      path+=` C ${x+step/3} ${y+bend} ${x+step*2/3} ${y+bend} ${x+step} ${y}`;
    }return path;
  }
  function pageNode(page,side='right',data=WordPaginator.document){
    const node=Base.pageNode(page,side,data);if(page.mode!=='manual')return node;
    const svg=node.querySelector('.manual-decorations'),groups=highlightGroups(data),rects=[...svg.querySelectorAll('rect')];
    for(let i=0;i<page.decorations.length;i++){
      const d=page.decorations[i],highlight=({'#00ffff':'cyan','#ffff00':'yellow'})[d.color.toLowerCase()];
      if(highlight&&d.width>2&&d.height>2){
        const radius=Math.min(WORD_LAYOUT_CONFIG.renderStyles.highlightRadius??3,d.width/2,d.height/2);
        rects[i].setAttribute('rx',radius);rects[i].setAttribute('ry',radius);rects[i].classList.add('rounded-highlight');
      }
      if(!highlight||highlight==='yellow'&&page.date.split('.').reduce((key,n)=>key*100+Number(n),0)<=20260523)continue;
      const candidates=page.blocks.flatMap(b=>b.glyphs).filter(g=>g.x+g.advance/2>=d.x-.5&&g.x+g.advance/2<=d.x+d.width+.5&&g.baseline>=d.y&&g.baseline<=d.y+d.height+2);
      const group=groups.find(mark=>mark.highlight===highlight&&candidates.some(g=>g.paragraphId===mark.paragraphId&&g.offset>=mark.start&&g.offset<mark.end));
      if(!group)throw Error('荧光笔矩形没有匹配到原文高亮范围');
      rects[i].setAttribute('fill',WORD_LAYOUT_CONFIG.renderStyles.highlightPalette[group.index%2]);rects[i].classList.add('soft-highlight');
      rects[i].dataset.sourceRange=`${group.paragraphId}:${group.start}-${group.end}`;
    }
    const border=borderGeometry(page,data);
    for(const mark of underlineGeometry(page,data,border)){
      rects[mark.index].remove();const path=document.createElementNS(NS,'path');path.classList.add('hand-underline');
      path.setAttribute('d',underlinePath(mark));path.setAttribute('fill','none');path.setAttribute('stroke',mark.color);
      path.setAttribute('stroke-width',mark.height);path.setAttribute('stroke-linecap','butt');path.setAttribute('stroke-linejoin','round');
      path.dataset.originalBox=JSON.stringify(mark);path.dataset.sourceRanges=JSON.stringify(mark.ranges);svg.append(path);
    }
    if(border){
      border.indices.forEach(i=>rects[i].remove());const path=document.createElementNS(NS,'path');path.classList.add('hand-list-border');
      path.setAttribute('d',framePath(border));path.setAttribute('fill','none');path.setAttribute('stroke',WORD_LAYOUT_CONFIG.renderStyles.borderColor);
      path.setAttribute('stroke-width',WORD_LAYOUT_CONFIG.renderStyles.borderStroke);path.setAttribute('stroke-linejoin','round');path.setAttribute('stroke-linecap','round');
      path.dataset.originalBox=JSON.stringify(border);svg.append(path);
    }
    // Keep native multi-codepoint emoji sequences in one HTML text span.
    for(const b of page.blocks){
      const paragraph=node.querySelector(`[data-source-id="${b.paragraphId}"]`);
      for(const g of b.glyphs.filter(g=>g.clusterComponent===0)){
        const start=paragraph.querySelector(`[data-source-offset="${g.offset}"]`);start.textContent=g.clusterText;start.dataset.sourceEnd=g.offset+Array.from(g.clusterText).length;
        b.glyphs.filter(p=>p.clusterStart===g.clusterStart&&p.clusterComponent>0).forEach(p=>paragraph.querySelector(`[data-source-offset="${p.offset}"]`).remove());
      }
    }
    return node;
  }
  window.WordRenderer={...Base,pageNode,highlightGroups,borderGeometry,underlineGeometry};
})();
