(() => {
  const settings=WORD_LAYOUT_CONFIG.bgm,tracks=settings.tracks,audio=document.getElementById('bgm-audio'),button=document.getElementById('bgm-toggle'),slider=document.getElementById('bgm-volume'),output=document.getElementById('bgm-volume-value'),status=document.getElementById('bgm-status'),trackSelect=document.getElementById('bgm-track'),loopSelect=document.getElementById('bgm-loop');
  let volume=settings.volume,wanted=settings.enabled!==false,pending=false,attempt=0,context=null,gain=null,resumeWhenVisible=false,index=0,loopMode=settings.loopMode;
  try{
    const saved=JSON.parse(localStorage.getItem(settings.storageKey));
    if(Number.isFinite(saved?.volume))volume=Math.max(0,Math.min(1,saved.volume));if(typeof saved?.enabled==='boolean')wanted=saved.enabled;
    const selected=tracks.findIndex(t=>t.id===saved?.trackId);if(selected>=0)index=selected;
    if(['playlist','single'].includes(saved?.loopMode))loopMode=saved.loopMode;
  }catch{/* Reading and playback work without browser storage. */}
  for(const track of tracks){const option=document.createElement('option');option.value=track.id;option.textContent=track.title;trackSelect.append(option);}
  audio.src=tracks[index].src;audio.loop=loopMode==='single';audio.volume=volume;audio.playbackRate=1;
  function save(){try{localStorage.setItem(settings.storageKey,JSON.stringify({volume,enabled:wanted,trackId:tracks[index].id,loopMode}));}catch{/* Keep the current session's settings. */}}
  function paint(){
    const active=pending||!audio.paused;button.textContent=active?'BGM：暂停':'BGM：播放';button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-busy',String(pending));
    slider.value=String(Math.round(volume*100));output.value=`${Math.round(volume*100)}%`;slider.setAttribute('aria-valuetext',output.value);
    trackSelect.value=tracks[index].id;trackSelect.title=tracks[index].title;loopSelect.value=loopMode;
  }
  function graph(){
    if(context)return;
    const Context=window.AudioContext||window.webkitAudioContext;if(!Context)return;
    try{
      context=new Context();gain=context.createGain();gain.gain.value=volume;
      const source=context.createMediaElementSource(audio);source.connect(gain);gain.connect(context.destination);audio.volume=1;
    }catch{context=null;gain=null;audio.volume=volume;}
  }
  function setVolume(value){
    if(!Number.isFinite(value))return;volume=Math.max(0,Math.min(1,value));
    if(gain)gain.gain.setTargetAtTime(volume,context.currentTime,.02);else audio.volume=volume;
    paint();save();
  }
  async function start(){
    if(!wanted||document.hidden)return false;if(pending||!audio.paused)return true;
    const ticket=++attempt;pending=true;status.hidden=true;paint();
    try{
      graph();const resumed=context?.state==='suspended'?context.resume():Promise.resolve();const playback=audio.play();await Promise.all([resumed,playback]);
      if(ticket!==attempt||!wanted||document.hidden)return false;return true;
    }catch(error){
      if(ticket===attempt&&error.name!=='AbortError'){audio.pause();status.hidden=false;status.textContent=error.name==='NotAllowedError'?'请点击“BGM：播放”开始音乐。':'音乐暂未播放，请点击 BGM 按钮重试。';}return false;
    }finally{if(ticket===attempt){pending=false;paint();}}
  }
  function stop(){attempt++;pending=false;audio.pause();paint();status.hidden=true;}
  function selectTrack(id,play=true){
    const next=tracks.findIndex(t=>t.id===id);if(next<0)return false;
    if(next!==index){stop();index=next;audio.src=tracks[index].src;audio.load();}
    wanted=play;if(!play)stop();else if(document.hidden)resumeWhenVisible=true;
    paint();save();if(play)start();return true;
  }
  function setLoopMode(value){if(!['playlist','single'].includes(value))return false;loopMode=value;audio.loop=value==='single';paint();save();return true;}
  button.addEventListener('click',()=>{if(pending||!audio.paused){wanted=false;stop();}else{wanted=true;start();}save();});
  slider.addEventListener('input',()=>{setVolume(Number(slider.value)/100);if(wanted&&(settings.startOn!=='first-page'||window.wordLayoutTest?.state>=0))start();});
  trackSelect.addEventListener('change',()=>selectTrack(trackSelect.value));
  loopSelect.addEventListener('change',()=>setLoopMode(loopSelect.value));
  document.addEventListener('missu-page-turn',event=>{
    const openingFirstPage=event.detail?.direction>0&&window.wordLayoutTest?.state===-1;
    if(wanted&&(settings.startOn!=='first-page'||openingFirstPage))start();
  });
  audio.addEventListener('play',paint);audio.addEventListener('pause',paint);
  audio.addEventListener('ended',()=>{if(loopMode==='playlist'&&wanted)selectTrack(tracks[(index+1)%tracks.length].id);});
  audio.addEventListener('error',()=>{pending=false;paint();status.hidden=false;status.textContent='音乐未能加载，请检查音乐文件后重试。';});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){resumeWhenVisible=wanted&&(pending||!audio.paused);stop();}
    else if(resumeWhenVisible&&wanted){resumeWhenVisible=false;start();}
  });
  addEventListener('pagehide',stop);
  window.missuBgm={play(){wanted=true;save();return start();},pause(){wanted=false;stop();save();},setVolume,selectTrack,setLoopMode,get track(){return{...tracks[index]};},get tracks(){return tracks.map(t=>({...t}));},get loopMode(){return loopMode;},get volume(){return volume;},get playing(){return!audio.paused;},get usingGain(){return!!gain;}};
  paint();
})();
