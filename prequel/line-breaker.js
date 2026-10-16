// Deterministic Chinese line breaking. Source newline is always a hard boundary.
(() => {
  const segmenter=new Intl.Segmenter('zh',{granularity:'word'}),cp=s=>Array.from(s);
  const names=['米酥','梳梳','猫猫神','酵母仙女','随身空间','空间异能','魔法蛋糕','魔法世界','细思极恐','粗思也恐','生活质量','自我介绍','好紧张啊','小鱼干','不锈钢盆','不锈钢小盆','鸡蛋花','本喵','MPhone','online'];
  const opening=/[（([【《〈“‘]$/,closing=/^[，。、；：！？!?,.;:）)\]】》〉”’%％…—～~]/;
  function boundaries(glyphs,protectedRanges,available){
    const text=glyphs.map(g=>g.text).join(''),allowed=new Set([glyphs[0]?.start||0]),base=glyphs[0]?.start||0;
    for(const s of segmenter.segment(text))allowed.add(base+cp(text.slice(0,s.index+s.segment.length)).length);
    for(const word of names)for(const m of text.matchAll(new RegExp(word,'g'))){const start=base+cp(text.slice(0,m.index)).length;for(let j=start+1;j<start+cp(word).length;j++)allowed.delete(j);}
    for(const m of text.matchAll(/[A-Za-z][A-Za-z0-9_-]*|\d+(?:\.\d+)*[年月日点岁只张个次天]?/g)){const start=base+cp(text.slice(0,m.index)).length;for(let j=start+1;j<start+cp(m[0]).length;j++)allowed.delete(j);}
    for(const r of protectedRanges){
      if(r.start<base||r.end>glyphs.at(-1).end)continue;
      const width=glyphs.filter(g=>g.start>=r.start&&g.end<=r.end).reduce((n,g)=>n+g.metrics.advance,0);
      if(width<=available)for(let j=r.start+1;j<r.end;j++)allowed.delete(j);
    }
    return allowed;
  }
  function wrap(clusters,width,firstIndent,protectedRanges=[]){
    const lines=[],records=[];let remaining=clusters.slice();
    while(remaining.length){
      const newline=remaining.findIndex(g=>g.text==='\n'),hardEnd=newline<0?remaining.length:newline,part=remaining.slice(0,hardEnd),indent=lines.length?0:firstIndent,available=width-indent;
      let count=0,used=0;while(count<part.length&&used+part[count].metrics.advance<=available+.001)used+=part[count++].metrics.advance;
      if(count===part.length){const n=hardEnd+(newline>=0?1:0),glyphs=remaining.splice(0,n);lines.push({glyphs,indent});records.push({kind:newline>=0?'manual':'block-end',offset:glyphs.at(-1)?.end||0});continue;}
      const allowed=boundaries(part,protectedRanges,available);let cut=count;
      const legal=i=>i>0&&allowed.has(part[i-1].end)&&!opening.test(part[i-1].text)&&!closing.test(part[i].text);
      while(cut>0&&!legal(cut))cut--;
      if(!cut){cut=Math.max(1,count);while(cut>1&&(opening.test(part[cut-1].text)||closing.test(part[cut].text)))cut--;}
      const glyphs=remaining.splice(0,cut);lines.push({glyphs,indent});records.push({kind:'automatic',offset:glyphs.at(-1).end,rule:cut===count?'word-boundary':'move-whole-word-or-punctuation',moved:part.slice(cut,count+1).map(g=>g.text).join('')});
    }
    if(!lines.length)lines.push({glyphs:[],indent:0});return{lines,records};
  }
  window.FullDiaryLineBreaker={wrap};
})();
