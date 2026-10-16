(() => {
  const audio=document.getElementById('page-turn-audio'),toggle=document.getElementById('sound-toggle'),status=document.getElementById('sound-status'),settings=WORD_LAYOUT_CONFIG.audio,slider=document.getElementById('sound-volume'),output=document.getElementById('sound-volume-value');
  let enabled=settings.enabled!==false,volume=settings.volume;
  try{const saved=JSON.parse(localStorage.getItem(settings.storageKey));if(Number.isFinite(saved?.volume))volume=Math.max(0,Math.min(1,saved.volume));if(typeof saved?.enabled==='boolean')enabled=saved.enabled;}catch{/* The controls remain usable without browser storage. */}
  audio.src=settings.pageTurn;audio.volume=volume;audio.loop=false;
  audio.playbackRate=settings.playbackRate;audio.defaultPlaybackRate=settings.playbackRate;audio.preservesPitch=true;
  function paint(){toggle.textContent=enabled?'关闭翻页声':'开启翻页声';toggle.setAttribute('aria-pressed',String(enabled));slider.value=String(Math.round(volume*100));output.value=`${Math.round(volume*100)}%`;slider.setAttribute('aria-valuetext',output.value);}
  function save(){try{localStorage.setItem(settings.storageKey,JSON.stringify({volume,enabled}));}catch{/* Keep these settings for the current session. */}}
  document.addEventListener('missu-page-turn',()=>{
    if(!enabled||audio.volume===0)return;
    audio.pause();audio.currentTime=0;
    audio.play().then(()=>{status.hidden=true;}).catch(error=>{
      if(error.name==='AbortError'||!enabled||document.hidden)return;
      status.hidden=false;status.textContent='声音暂未播放，请再点击翻页重试。';
    });
  });
  toggle.addEventListener('click',()=>{
    enabled=!enabled;paint();save();
    if(!enabled){audio.pause();audio.currentTime=0;}
    status.hidden=true;
  });
  slider.addEventListener('input',()=>{
    const value=Number(slider.value);if(!Number.isFinite(value))return;
    volume=Math.max(0,Math.min(1,value/100));audio.volume=volume;paint();save();status.hidden=true;
    if(volume===0){audio.pause();audio.currentTime=0;}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.pause();audio.currentTime=0;}});
  paint();
})();
