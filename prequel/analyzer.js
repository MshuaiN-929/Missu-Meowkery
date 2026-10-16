(() => {
  const cp=s=>Array.from(s),clone=x=>structuredClone(x);
  const palette={body:'#536780',missu:'#975956',shushu:'#827399',aside:'#657F70'};
  function classify(text){
    const s=text.trim();
    if(!s)return{type:'blank',reason:'保留原稿空行'};
    if(/^2026\.\d+\.\d+$/.test(s))return{type:'date',reason:'原文日期'};
    if(/^(?:【[^】]*】|\d+[、.．]|[①②③④⑤⑥⑦⑧⑨])/.test(s))return{type:'list',reason:'原文清单'};
    if(/^（[^）]*）[。！!？?]*$/.test(s))return{type:'aside',reason:'括号补充'};
    if(s.length<=65&&(s.match(/[！!]/g)||[]).length>=3)return{type:'outburst',reason:'连续感叹的情绪句'};
    if(/^(?:我|梳梳|猫猫神|酵母仙女|她)?[：:]?\s*“[^”]+”[。！？!?]*$/.test(s))return{type:'dialogue',reason:'独立引语；说话者另行判定'};
    if(s.length<55&&/^(?:等等|等一下|但是|不过|然而|然后！|结果！|总之|话说|算了|终于|我发现|我突然|至少——)/.test(s))return{type:'turn',reason:'原文转折或发现'};
    return{type:'narrative',reason:'普通叙述'};
  }
  function sliceTokens(p,start,end){return p.tokens.filter(t=>t.end>start&&t.start<end).map(t=>{const a=Math.max(start,t.start),b=Math.min(end,t.end);return{...clone(t),start:a,end:b,text:cp(t.text).slice(a-t.start,b-t.start).join('')};});}
  // Uniform ordinary ink is eligible by the user's explicit round-two decision.
  function eligible(p,t){
    const s=t.style;
    return (!s.color||s.color.toUpperCase()===palette.body)&&!s.b&&!s.i&&!s.u&&!s.highlight&&!s.shd&&!s.strike&&!s.dstrike&&s.fontSizePt===11
      &&!p.paragraphStyle.pBdr&&(!p.paragraphStyle.jc||p.paragraphStyle.jc.val==='left')
      && !p.tokens.some(r=>r.style.color&&r.style.color.toUpperCase()!==palette.body);
  }
  function fragments(p){
    const length=cp(p.text).length,boundaries=[...new Set([0,...(p.breaks||[]).filter(b=>b.explicit&&b.kind==='page').map(b=>b.offset),length])].sort((a,b)=>a-b),units=[];
    if(!length)return[{paragraphId:p.id,start:0,end:0,type:'blank',reason:'原有空段落',breakBefore:(p.breaks||[]).some(b=>b.explicit&&b.kind==='page')}];
    for(let k=0;k<boundaries.length-1;k++){
      const start=boundaries[k],end=boundaries[k+1],text=cp(p.text).slice(start,end).join(''),breakBefore=(p.breaks||[]).some(b=>b.explicit&&b.kind==='page'&&b.offset===start);
      const designed=!!p.paragraphStyle.jc||!!p.paragraphStyle.pBdr||p.tokens.some(t=>t.style.color&&t.style.color.toUpperCase()!==palette.body);
      if((!text.includes('\n')||designed)&&p.kind!=='dateWithBody'){units.push({paragraphId:p.id,start,end,...classify(text),breakBefore});continue;}
      let offset=start,group,previous='';
      for(const line of text.match(/[^\n]*\n|[^\n]+$/g)||[]){
        const size=cp(line).length,tag=classify(line),s=line.trim();
        // Group grammatical continuations and introduced explanations, not N sentences/characters.
        const continuation=/^(?:而且|于是|所以|因为|也就是说|换句话说|至少|再加上|还(?:有|会|要)|又(?:能|可以)|然后又)/.test(s)||/[：:]$/.test(previous.trim());
        const anchor=previous.trim()==='但是……'&&s==='如果是梳梳呢？';
        const merge=group&&((tag.type==='narrative'&&group.type==='narrative'&&continuation)||anchor);
        if(merge){group.end=offset+size;if(anchor){group.type='turn';group.reason='保留关键转折及其下一行';group.anchor='shushu-decision';}}
        else{group={paragraphId:p.id,start:offset,end:offset+size,...tag,breakBefore:offset===start&&breakBefore};units.push(group);}
        offset+=size;previous=line;
      }
    }
    if((p.breaks||[]).some(b=>b.explicit&&b.kind==='page'&&b.offset===length))units.push({kind:'break',paragraphId:p.id,start:length,end:length});
    return units;
  }
  function configFor(unit,p){
    const raw=p.manualParagraphStyle,props=p.paragraphStyle,align=props.jc?.val,focus=unit.type==='outburst',date=unit.type==='date';
    const automatic={fontSizePt:date?18:focus?13:unit.type==='aside'?9.5:11,color:palette.body,align:align||(focus&&unit.end-unit.start<45?'center':'left'),
      inset:unit.type==='aside'&&!raw.ind?18:unit.type==='dialogue'&&!raw.ind?10:0,
      indent:!props.ind&&unit.type==='narrative'&&unit.end-unit.start>85?'2em':null,
      gapBefore:['outburst','turn'].includes(unit.type)?10:unit.type==='aside'?6:4,rotation:0};
    return{...unit,kind:'autoBlock',automatic,marks:[],emphasis:[],formatProvenance:{color:'manual-unless-uniform-baseline',baselineAutoColourAuthorized:true},manual:{paragraphProperties:clone(raw),priority:'word-first'}};
  }
  function addRange(list,p,start,end,role,reason,speaker){
    for(const t of p.tokens.filter(t=>t.end>start&&t.start<end&&eligible(p,t)))list.push({start:Math.max(t.start,start),end:Math.min(t.end,end),color:palette[role],role,speaker:speaker||null,reason,origin:'automatic',overridesBaselineOnly:true});
  }
  function semanticRanges(entry){
    const ranges=new Map(),dialogues=new Map();let person=null,previous='';
    for(const p of entry.paragraphs){
      const list=[],decisions=[];let offset=0;
      for(const line of p.text.match(/[^\n]*\n|[^\n]+$/g)||[]){
        const narrative=line.replace(/“[^”]*”/g,'');
        if(/梳梳/.test(narrative)&&/(?:找|见|当着|问|摸|擦|抱|背|说|吃饭|看着)/.test(narrative))person='shushu';
        if(/酵母仙女/.test(narrative))person='fairy';
        if(/猫猫神/.test(narrative)&&/(?:出现|冒|说|问|告诉|梦|睡|看了)/.test(narrative))person='god';
        if(/听见后面传来声音/.test(line))person='unknown';
        const guessed=/我猜|她大概会说|第一反应应该|我原本以为/.test(previous+line);
        for(const match of line.matchAll(/“([^”]*)”/g)){
          const a=offset+cp(line.slice(0,match.index)).length,z=a+cp(match[0]).length,before=line.slice(0,match.index);
          let speaker='unknown';
          if(/^(?:(?:喵|呼噜)+[，,。？！!?~～…\s]*)+$/.test(match[1]))speaker='missu';
          else if(/(?:^|[。！!?？])我[：:]\s*$/.test(before)||/我.{0,8}(?:问|说|喊).{0,4}[：:]?\s*$/.test(before)||/我(?:又)?(?:试探|谨慎地问)/.test(previous))speaker='missu';
          else if(/梳梳[：:]\s*$/.test(before))speaker='shushu';
          else if(/猫猫神[：:]\s*$/.test(before))speaker='god';
          else if(/酵母仙女[：:]\s*$/.test(before))speaker='fairy';
          else if(/她.{0,10}(?:说|问|念|摸|笑|顿)|她[：:]|她一看见我|她把我抱|她.*给我擦|今天梳梳问我/.test(before+previous)||/她.{0,10}(?:伸出|一边擦)/.test(line.slice(match.index+match[0].length)))speaker=person||'unknown';
          else if(person==='shushu'&&/^(?:咪咪|小猫咪)[，,？?]/.test(match[1]))speaker='shushu';
          decisions.push({start:a,end:z,speaker,actual:!guessed,origin:'automatic',context:previous.trim()});
          if(speaker==='shushu'&&!guessed)addRange(list,p,a,z,'shushu','上下文中的梳梳实际对白',speaker);
          if(speaker==='missu'&&/喵/.test(match[1]))addRange(list,p,a,z,'missu','米酥实际发出的喵',speaker);
        }
        for(const m of line.matchAll(/（[^）\n]*）/g)){const a=offset+cp(line.slice(0,m.index)).length;addRange(list,p,a,a+cp(m[0]).length,'aside','括号补充或自嘲');}
        for(const m of line.matchAll(/喵+/g)){
          const left=line.slice(Math.max(0,m.index-2),m.index),right=line.slice(m.index+m[0].length,m.index+m[0].length+2);
          if(/本$/.test(left)||/[“：:]$/.test(left)||m[0].length>1&&!/感/.test(right)){const a=offset+cp(line.slice(0,m.index)).length;addRange(list,p,a,a+cp(m[0]).length,'missu','米酥的喵音/自称','missu');}
        }
        if(classify(line).type==='outburst'){
          const m=/[^。！？!?\n]*[！!]{2,}/.exec(line);
          if(m){const a=offset+cp(line.slice(0,m.index)).length;addRange(list,p,a,a+cp(m[0]).length,'missu','连续感叹的情绪重点','missu');}
        }
        const s=line.trim();
        if(/^(?:……(?:应该|也许|大概).*吧|想想.*细思极恐)/.test(s))addRange(list,p,offset,offset+cp(line.replace(/\n$/,'')).length,'aside','轻声自言自语');
        offset+=cp(line).length;if(s)previous=line;
      }
      ranges.set(p.id,list);dialogues.set(p.id,decisions);
    }return{ranges,dialogues};
  }
  function analyze(entry){
    const result=[],{ranges,dialogues}=semanticRanges(entry);let lastMark=-1000,position=0;
    for(const p of entry.paragraphs)for(const unit of fragments(p)){
      if(unit.kind==='break'){result.push(unit);continue;}
      const b=configFor(unit,p),text=cp(p.text).slice(b.start,b.end).join('');
      b.emphasis=ranges.get(p.id).filter(r=>r.start<b.end&&r.end>b.start).map(r=>({...r,start:Math.max(b.start,r.start),end:Math.min(b.end,r.end)}));
      b.dialogues=dialogues.get(p.id).filter(r=>r.start<b.end&&r.end>b.start);
      const hit=/有异能了！！！|随身空间|魔法蛋糕|如果是梳梳呢？|好紧张啊|先把名字告诉她/.exec(text);
      if(hit&&position-lastMark>200&&!p.tokens.some(t=>t.style.highlight||t.style.u)){
        const a=b.start+cp(text.slice(0,hit.index)).length,z=a+cp(hit[0]).length;
        if(p.tokens.filter(t=>t.start<z&&t.end>a).every(t=>eligible(p,t))){
          b.marks.push({kind:/好紧张|名字/.test(hit[0])?'underline':'highlight',start:a,end:z,color:/梳梳/.test(hit[0])?'#DCE6ED':'#F5E6AD',reason:'内容中的发现、决定或紧张/结尾锚点',origin:'automatic'});lastMark=position;
          if(/梳梳/.test(hit[0]))b.automatic.gapBefore=15;
        }
      }
      position+=b.end-b.start;result.push(b);
    }return result;
  }
  function effectiveStyle(token,b,offset=token.start){
    const s={...token.style};if(!token.manualStyle?.sz&&s.fontSizePt===11)s.fontSizePt=b.automatic.fontSizePt;if(!s.color)s.color=b.automatic.color;
    const matches=(b.emphasis||[]).filter(r=>offset>=r.start&&offset<r.end),range=matches.find(r=>r.role==='aside')||matches.at(-1);
    if(range)s.color=range.color;return{...s,...token.overrides};
  }
  window.FullDiaryAnalyzer={analyze,sliceTokens,classify,eligible,effectiveStyle,palette};
})();
