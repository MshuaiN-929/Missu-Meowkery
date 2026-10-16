(() => {
  const settings=document.getElementById('audio-settings'),summary=settings.querySelector('summary'),panel=document.getElementById('audio-panel');
  function fit(){
    if(!settings.open)return;panel.style.transform='none';
    const box=panel.getBoundingClientRect(),shift=Math.max(0,12-box.left)-Math.max(0,box.right-innerWidth+12);
    panel.style.transform=`translateX(${shift}px)`;panel.style.maxHeight=`${Math.max(100,innerHeight-box.top-12)}px`;
  }
  settings.addEventListener('toggle',()=>{summary.setAttribute('aria-expanded',String(settings.open));fit();});
  addEventListener('resize',fit);
  document.addEventListener('click',event=>{if(settings.open&&!settings.contains(event.target))settings.open=false;});
  settings.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&settings.open){event.preventDefault();event.stopPropagation();settings.open=false;summary.focus();}
    else if(settings.open&&(event.key==='ArrowLeft'||event.key==='ArrowRight'))event.stopPropagation();
  });
})();
