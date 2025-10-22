/* ExoGrid™ Monitoring – Mock Backend API (no dependencies)
   Provides: getSuits, getSuitById, getMetrics, getKPIs, getEvents, exportMetricsCsv
   Swap data generators for real fetch() later; keep same method signatures. */

(function(){
  const suits = [
    { id:"XS-001", assetTag:"EXO-XS-001", operator:"Anna K.",   site:"Linz Plant A",    model:"ExoGrid X1", commissioned:"2025-06-12" },
    { id:"XS-002", assetTag:"EXO-XS-002", operator:"Michael T.",site:"Graz Logistics",  model:"ExoGrid X1", commissioned:"2025-07-03" },
    { id:"XS-003", assetTag:"EXO-XS-003", operator:"Rahim S.",  site:"Vienna Assembly", model:"ExoGrid X1", commissioned:"2025-08-20" },
    { id:"XS-004", assetTag:"EXO-XS-004", operator:"Laura M.",  site:"Leoben R&D",      model:"ExoGrid X1", commissioned:"2025-09-02" },
  ];
  function getSuitById(id){ return suits.find(s=>s.id===id)||suits[0]; }

  // deterministic PRNG -> stable graphs between refreshes
  let seed = 20251022;
  function rnd(){ const x = Math.sin(seed++)*10000; return x - Math.floor(x); }
  const rand=(min,max)=> min + rnd()*(max-min);
  const randi=(min,max)=> Math.floor(rand(min,max+1));
  const clamp=(v,lo,hi)=> Math.max(lo, Math.min(hi,v));
  const iso=(d)=> d.toISOString().slice(0,10);

  function daysBetween(from,to){
    const s=new Date(from), e=new Date(to);
    s.setHours(0,0,0,0); e.setHours(0,0,0,0);
    const out=[];
    for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)) out.push(new Date(d));
    return out;
  }

  function genDailyMetrics(suitId, from, to){
    const dates = daysBetween(from,to); const labels = dates.map(iso);
    const base = 0.25 + ((parseInt((suitId||'0').slice(-1),10) || 1)*0.08);
    let soc = randi(55,85);

    const harvest=[], use=[], socSeries=[];
    const src={kinetic:[],thermal:[],piezo:[],regen:[]};

    dates.forEach((_,i)=>{
      const activity = 0.9 + 0.35*Math.sin(i/3) + base + (rnd()-0.5)*0.15;
      const h = clamp(1.9*activity + rand(0,0.5), 0.9, 3.4);
      const u = clamp(1.5*activity + rand(0,0.7), 0.8, 3.2);
      harvest.push(+h.toFixed(2)); use.push(+u.toFixed(2));

      const kin=h*(0.46 + (rnd()-0.5)*0.05);
      const thr=h*(0.24 + (rnd()-0.5)*0.04);
      const pie=h*(0.18 + (rnd()-0.5)*0.03);
      const reg=Math.max(0,h-(kin+thr+pie));
      src.kinetic.push(+kin.toFixed(2));
      src.thermal.push(+thr.toFixed(2));
      src.piezo.push(+pie.toFixed(2));
      src.regen.push(+reg.toFixed(2));

      soc = clamp(soc + Math.round((h-u)*7) + randi(-2,2), 12, 100);
      socSeries.push(soc);
    });

    const deviceBreakdown = {
      "AR Glasses": randi(6,20),
      "Hand Scanner": randi(25,70),
      "Tablet": randi(10,30),
      "Torque Tool": randi(4,14),
      "Env Sensor": randi(12,32),
    };

    const weeks = Math.ceil(dates.length/7);
    const weekly={labels:[],uptimePct:[]};
    for(let w=0;w<weeks;w++){ weekly.labels.push(`W${w+1}`); weekly.uptimePct.push(clamp(90 + randi(-6,5), 70, 99)); }

    return { labels, socSeries, harvest, consumption:use, sources:src, deviceBreakdown, weekly };
  }

  function genKPIs(m){
    const soc = m.socSeries.at(-1) ?? 60;
    const harvestKWh = m.harvest.reduce((a,b)=>a+b,0);
    const devicesCharged = Object.values(m.deviceBreakdown).reduce((a,b)=>a+b,0);
    const avgSoc = m.socSeries.reduce((a,b)=>a+b,0)/m.socSeries.length;
    let health='OK';
    if(avgSoc<35 || m.harvest.some(v=>v<1.0)) health='WARNING';
    if(m.socSeries.some(v=>v<15)) health='MAINTENANCE';
    const uptimePct=Math.round(m.weekly.uptimePct.reduce((a,b)=>a+b,0)/m.weekly.uptimePct.length);
    return { soc, harvestKWh, devicesCharged, uptimePct, health };
  }

  function genEvents(from,to){
    const sev={TEMP_HIGH:'WARNING',IMPACT:'CRITICAL',DOCKING_FAIL:'WARNING',SENSOR_FAULT:'CRITICAL',LOW_SOC:'WARNING',MAINT_DUE:'INFO'};
    const msg={TEMP_HIGH:'Thermal sensor peak above nominal.',IMPACT:'High-G shock detected on right hip joint.',DOCKING_FAIL:'Dock handshake timed out.',SENSOR_FAULT:'IMU calibration drift detected.',LOW_SOC:'Battery SoC below 15%.',MAINT_DUE:'Preventive maintenance due in 7 days.'};
    const codes=Object.keys(sev); const out=[];
    daysBetween(from,to).forEach(d=>{
      const n=randi(0,2);
      for(let i=0;i<n;i++){
        const c=codes[randi(0,codes.length-1)];
        const t=new Date(d.getTime()+randi(7,18)*3600000+randi(0,59)*60000);
        out.push({time:t.toISOString().replace('T',' ').slice(0,16),severity:sev[c],code:c,message:msg[c]});
      }
    });
    return out.sort((a,b)=>b.time.localeCompare(a.time));
  }

  async function getSuits(){ return suits; }
  async function getMetrics(suitId,{from,to}={}){
    const end = to || new Date().toISOString().slice(0,10);
    const start = from || new Date(Date.now()-6*86400000).toISOString().slice(0,10);
    return genDailyMetrics(suitId||suits[0].id,start,end);
  }
  async function getKPIs(suitId,range){ const m=await getMetrics(suitId,range); return genKPIs(m); }
  async function getEvents(_suitId,{from,to}={}){
    const end = to || new Date().toISOString().slice(0,10);
    const start = from || new Date(Date.now()-6*86400000).toISOString().slice(0,10);
    return genEvents(start,end);
  }
  async function exportMetricsCsv(suitId,range){
    const suit=getSuitById(suitId); const m=await getMetrics(suitId,range);
    const header=['date','soc_%','harvest_kWh','consumption_kWh','kinetic_kWh','thermal_kWh','piezo_kWh','regen_kWh'].join(',');
    const rows=m.labels.map((d,i)=>[d,m.socSeries[i],m.harvest[i],m.consumption[i],m.sources.kinetic[i],m.sources.thermal[i],m.sources.piezo[i],m.sources.regen[i]].join(','));
    const meta=`# suit,${suit.assetTag}\n# operator,${suit.operator}\n# site,${suit.site}\n`;
    return `${meta}${header}\n${rows.join('\n')}\n`;
  }

  window.ExoAPI = { getSuits, getSuitById, getMetrics, getKPIs, getEvents, exportMetricsCsv };
})();
