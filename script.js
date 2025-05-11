const CUSTOM_KEYS=["ברכות","רבי ישמעאל","ישתבח","קריאת שמע","אמת","תהילות"],
DEFAULT_OFFSETS={
  "ברכות": -1620,      // 8:00 before netz
  "רבי ישמעאל": -1140, // 11:00 before netz
  "ישתבח": -480,       // 3:45 before netz
  "קריאת שמע": -255,   // 2:30 before netz
  "אמת": -135,         // 1:45 before netz
  "תהילות": -30        // 0:30 before netz
},
CORE_KEYS=["Alos72","Sunrise"],
CORE_LABELS={Alos72:"עלות השחר",Sunrise:"הנץ החמה (מדויק)"};

function formatTime(d){return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',second:'2-digit',hour12:true}).replace(/\s?(AM|PM)/,'')}
function formatCountdown(sec){const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60,p=n=>n<10?'0'+n:n;return h>0?`${h}:${p(m)}:${p(s)}`:`${m}:${p(s)}`}
function updateClock(){document.getElementById("clock").textContent=formatTime(new Date())}
const hebrewWeekdays = ["יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "יום שבת"];

async function updateHebrewDate(date){
  try{
    const res=await fetch(`https://www.hebcal.com/converter?cfg=json&gy=${date.getFullYear()}&gm=${date.getMonth()+1}&gd=${date.getDate()}&g2h=1`);
    const data=await res.json();
    const weekdayName = hebrewWeekdays[date.getDay()];
    document.getElementById("hebrewDate").textContent = `${weekdayName} - ${data.hebrew}`;
  }catch{
    document.getElementById("hebrewDate").textContent="שגיאה בתאריך";
  }
}

async function fetchLocation(){
  const cached=localStorage.getItem('location');
  if(cached){
    try{
      const obj=JSON.parse(cached);
      if(typeof obj.lat==='number'&&typeof obj.lon==='number') return obj;
    }catch{}
  }
  return new Promise(r=>{
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(p=>{
        const l={lat:p.coords.latitude,lon:p.coords.longitude};
        localStorage.setItem('location',JSON.stringify(l));
        r(l)
      },()=>r({lat:40.0821,lon:-74.2097}),{enableHighAccuracy:true,timeout:10000})
    }else r({lat:40.0821,lon:-74.2097})
  })
}
let raw=null;
async function updateAddressDisplay(lat, lon) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`);
    const data = await res.json();
    const address = data.display_name || "לא נמצא כתובת";
    let el = document.getElementById("userAddress");
    if (!el) {
      el = document.createElement("div");
      el.id = "userAddress";
      el.style.textAlign = "center";
      el.style.margin = "10px 0 0 0";
      el.style.fontSize = "1em";
      el.style.color = "#888";
      const header = document.querySelector('header');
      header.parentNode.insertBefore(el, header.nextSibling);
    }
    el.textContent = address;
  } catch {
    // Optionally handle error
  }
}

async function updateZmanim(date){
  const {lat,lon} = await fetchLocation();
  const elevation = 0; // currently hardcoded, can be made dynamic
  raw = KosherZmanim.getZmanimJson({
    date: date.toISOString().slice(0,10),
    timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locationName: "Local",
    latitude: lat,
    longitude: lon,
    elevation: elevation,
    complexZmanim: true
  }).Zmanim;
  console.log('Your coordinates:', {lat, lon, elevation});
  console.log('All zmanim keys:', raw);
  updateAddressDisplay(lat, lon);
}
async function updateSelectedDateNetz(date){
  const netzLabel=document.getElementById('netzLabel'),netzDiv=document.getElementById('selectedDateNetz'),d=date,dd=String(d.getDate()).padStart(2,'0'),mm=String(d.getMonth()+1).padStart(2,'0'),yyyy=d.getFullYear();
  netzLabel.innerHTML=`נץ החמה (מדויק) ל־<span style='direction:ltr;'>${dd}/${mm}/${yyyy}</span>:`;
  try{
    const{lat,lon}=await fetchLocation(),zmanim=KosherZmanim.getZmanimJson({date:date.toISOString().slice(0,10),timeZoneId:Intl.DateTimeFormat().resolvedOptions().timeZone,locationName:"Local",latitude:lat,longitude:lon,elevation:0,complexZmanim:true}).Zmanim;
    const netzKey = zmanim.Sunrise90 || zmanim.Sunrise90Degrees || zmanim.SunriseOffset90 || zmanim.Sunrise;
    if(netzKey){
      const netzTime=new Date(netzKey);
      netzDiv.textContent=`🕒 ${formatTime(netzTime)}`;
    }else{
      netzDiv.textContent='לא ניתן לחשב את זמן הנץ לתאריך זה';
    }
  }catch(e){
    netzDiv.textContent='שגיאה בחישוב זמן הנץ';
  }
}
function getOffsetsForDate(date){
  const dateStr = date.toISOString().split('T')[0],
        dateKey = `offsets-${dateStr}`,
        storedOffsets = localStorage.getItem(dateKey);
  return storedOffsets
    ? JSON.parse(storedOffsets)
    : { ...DEFAULT_OFFSETS };
}
function updateSettingsForm(date){
  const offsets=getOffsetsForDate(date),durations=offsetsToDurations(offsets);
  CUSTOM_KEYS.forEach(k=>{
    const m=document.querySelector(`input[name='${k}_min']`),s=document.querySelector(`input[name='${k}_sec']`);
    if(m&&s){m.value=durations[k].minutes;s.value=durations[k].seconds}
  });
  updateSelectedDateNetz(date);
}
function render(){
  const now=new Date(),selectedDate=new Date(document.getElementById('settingsDatePicker').value),userOffsets=getOffsetsForDate(selectedDate),list=[];
  CORE_KEYS.forEach(k=>{if(raw[k])list.push({name:CORE_LABELS[k],time:new Date(raw[k])})});
  const netzKey = raw.Sunrise90 || raw.Sunrise90Degrees || raw["Sunrise Offset 90"] || raw.Sunrise;
  if(netzKey){
    const netz = new Date(netzKey);
    CUSTOM_KEYS.forEach(k=>{const t=new Date(netz.getTime()+userOffsets[k]*1000);list.push({name:k,time:t})})
  }else if(raw.Sunrise){
    list.push({name: "הנץ החמה", time: new Date(raw.Sunrise)})
  }
  const sorted=list.slice().sort((a,b)=>a.time-b.time),next=sorted.find(z=>z.time>now),labelEl=document.getElementById("currentZmanLabel"),timeEl=document.getElementById("currentZmanTime"),countdownEl=document.getElementById("countdown"),zmanListEl=document.getElementById("zmanList");
  if(next){
    labelEl.textContent=next.name;
    timeEl.textContent=formatTime(next.time);
    countdownEl.textContent=formatCountdown(Math.floor((next.time-now)/1000))
  }else{
    labelEl.textContent="אין זמני וותיקין זמינים כרגע";
    timeEl.textContent="--:--:--";
    countdownEl.textContent="--:--"
  }
  zmanListEl.innerHTML='';
  sorted.forEach(({name,time})=>{
    const d=document.createElement('div');
    if(name===next?.name)d.classList.add('next');
    d.innerHTML=`<span>${name}</span><span>${formatTime(time)}</span>`;
    zmanListEl.append(d)
  })
}
function updateUserSettingsAndRender(){const selectedDate=new Date(document.getElementById('settingsDatePicker').value);userOffsets=getOffsetsForDate(selectedDate);render()}
function offsetsToDurations(offsets){const keys=Object.keys(offsets).sort((a,b)=>offsets[a]-offsets[b]),durations={};for(let i=0;i<keys.length-1;i++){const c=keys[i],n=keys[i+1],s=Math.abs(offsets[n]-offsets[c]);durations[c]={minutes:Math.floor(s/60),seconds:s%60}}const l=keys[keys.length-1],ls=Math.abs(offsets[l]);durations[l]={minutes:Math.floor(ls/60),seconds:ls%60};return durations}
(async()=>{
  const today=new Date(),settingsDatePicker=document.getElementById("settingsDatePicker"),settingsBtn=document.getElementById("settingsBtn"),settingsModal=document.getElementById("settingsModal"),settingsForm=document.getElementById("settingsForm"),cancelSettings=document.getElementById("cancelSettings");
  settingsDatePicker.value=today.toISOString().split('T')[0];
  settingsBtn.onclick=()=>{settingsDatePicker.value=today.toISOString().split('T')[0];settingsModal.style.display="flex";updateSettingsForm(today)};
  cancelSettings.onclick=()=>settingsModal.style.display="none";
  settingsModal.onclick=e=>{if(e.target===settingsModal)settingsModal.style.display="none"};
  window.addEventListener('keydown',e=>{if(e.key==='Escape')settingsModal.style.display="none"});
  settingsDatePicker.onchange=()=>{const d=new Date(settingsDatePicker.value);if(isNaN(d.getTime())){settingsDatePicker.value=today.toISOString().split('T')[0];updateSettingsForm(today);return}updateSettingsForm(d)};
  settingsForm.onsubmit=e=>{e.preventDefault();const d=new Date(settingsDatePicker.value);if(isNaN(d.getTime())){alert('אנא בחר תאריך תקין');return}const durations={};CUSTOM_KEYS.forEach(k=>{const m=parseInt(settingsForm.querySelector(`input[name='${k}_min']`).value,10)||0,s=parseInt(settingsForm.querySelector(`input[name='${k}_sec']`).value,10)||0;durations[k]=m*60+s});let t=0,offsets={};[...CUSTOM_KEYS].reverse().forEach(k=>{t+=durations[k];offsets[k]=-t});const ds=settingsDatePicker.value;localStorage.setItem(`offsets-${ds}`,JSON.stringify(offsets));settingsModal.style.display="none";updateUserSettingsAndRender()};
  const resetBtn=document.getElementById('resetDefaults');
  if(resetBtn){
    resetBtn.onclick=function(){const d=offsetsToDurations(DEFAULT_OFFSETS);CUSTOM_KEYS.forEach(k=>{const m=settingsForm.querySelector(`input[name='${k}_min']`),s=settingsForm.querySelector(`input[name='${k}_sec']`);if(m&&s){m.value=d[k].minutes;s.value=d[k].seconds}});const ds=settingsDatePicker.value;localStorage.setItem(`offsets-${ds}`,JSON.stringify(DEFAULT_OFFSETS));updateUserSettingsAndRender()}
  }
  updateClock();setInterval(updateClock,1000);await updateHebrewDate(today);await updateZmanim(today);render();setInterval(render, 1000);
})(); 
