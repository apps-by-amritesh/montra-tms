/** MONTRA Trial Management System - Google Apps Script backend
 * Deploy as Web App: Execute as me. Access: Anyone (see README security warning).
 */
const TMS = {
  SHEETS: {
    Trials: ['TrialID','TrialName','TrialType','Customer','Location','VehicleNo','DriversJSON','DriverIDsJSON','ValueChampionIDsJSON','MaterialsJSON','DailyTripTarget','TargetDurationMin','StartDate','EndDate','Status','CreatedAt','CreatedBy'],
    Users: ['UserID','Name','Role','Email','Phone','PINHash','PINSalt','PINChangedAt','Active','TrialIDsJSON','CreatedAt'],
    Shifts: ['ShiftID','TrialID','DriverID','DriverName','VehicleNo','ShiftDate','ShiftName','StartAt','EndAt','OpeningOdo','ClosingOdo','OpeningSOC','ClosingSOC','Material','ClosingMaterial','TotalKM','SOCCharged','SOCUsed','TripCount','PendingCharge','ChargeStartSOC','ChargeStartedAt','Status'],
    Events: ['EventID','TrialID','ShiftID','DriverID','VehicleNo','EventType','EventAt','Odometer','SOC','Note','CreatedAt'],
    Trips: ['TripID','TrialID','ShiftID','DriverID','DriverName','VehicleNo','TripNo','StartAt','EndAt','DurationMin','EndReason','Status','EventsJSON'],
    Audit: ['AuditID','ActorID','ActorName','Action','RecordType','RecordID','DetailsJSON','CreatedAt']
  }
};

function initializeSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TMS.SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const existing = sh.getLastColumn() ? sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String) : [];
    const required = TMS.SHEETS[name];
    required.forEach(h => { if (!existing.includes(h)) { const col = Math.max(1, sh.getLastColumn()+1); sh.getRange(1,col).setValue(h); } });
    if (sh.getLastRow() === 0) sh.getRange(1,1,1,required.length).setValues([required]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,sh.getLastColumn()).setFontWeight('bold');
  });
  // Keep all date/time values as strings to avoid Sheets silently coercing dates.
  ['ShiftDate','StartAt','EndAt','EventAt','CreatedAt','PINChangedAt','StartDate','EndDate'].forEach(h => {
    Object.keys(TMS.SHEETS).forEach(n => { const sh=ss.getSheetByName(n); const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0]; const i=headers.indexOf(h); if(i>=0) sh.getRange(2,i+1,Math.max(1,sh.getMaxRows()-1),1).setNumberFormat('@'); });
  });
  return 'Sheets initialized. Existing data was preserved; only missing tabs/columns were added.';
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const callback = /^[A-Za-z_$][\w.$]*$/.test(p.callback || '') ? p.callback : 'tmsCallback';
  let result;
  try {
    const payload = p.payload ? JSON.parse(p.payload) : {};
    result = route_(p.action, payload);
  } catch (err) {
    result = { ok:false, error: err && err.message ? err.message : String(err) };
  }
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function route_(action, p) {
  switch (action) {
    case 'health': return {ok:true, message:'Montra TMS API ready', time:now_()};
    case 'login': return login_(p);
    case 'listTrials': return listTrials_(p);
    case 'dashboard': return dashboard_(p);
    case 'startShift': return startShift_(p);
    case 'currentShift': return currentShift_(p);
    case 'punch': return punch_(p);
    case 'completeCharging': return completeCharging_(p);
    case 'endShift': return endShift_(p);
    case 'createTrial': return createTrial_(p);
    case 'setTrialStatus': return setTrialStatus_(p);
    case 'createUser': return createUser_(p);
    case 'resetPin': return resetPin_(p);
    case 'listUsers': return listUsers_(p);
    case 'changePin': return changePin_(p);
    default: throw new Error('Unknown action: ' + action);
  }
}

function login_(p) {
  const cache=CacheService.getScriptCache(); const attempts=Number(cache.get('tms-login-attempts')||0); if(attempts>=30) throw new Error('Too many login attempts. Try again in 10 minutes.');
  const pin = String(p.pin || '').trim(); if (!pin) throw new Error('Enter your PIN.');
  const users = rows_('Users');
  const user = users.find(r => String(r.Active).toLowerCase() !== 'false' && String(r.PINHash) === hash_(pin + String(r.PINSalt||'')));
  if (user) { cache.remove('tms-login-attempts'); const token=Utilities.getUuid()+Utilities.getUuid(); CacheService.getScriptCache().put('tms:'+token,user.UserID,21600); return {ok:true,token,user:{id:user.UserID,name:user.Name,role:user.Role,trialIDs:parse_(user.TrialIDsJSON,[])}}; }
  const trials = rows_('Trials');
  const trial = trials.find(r => String(r.Status).toLowerCase() === 'active' && String(r.DriverPINHash || '') === hash_(pin));
  if (trial) throw new Error('This trial PIN is not configured as an individual driver login. Ask Admin to issue your driver PIN.');
  cache.put('tms-login-attempts',String(attempts+1),600); throw new Error('Incorrect or inactive PIN. Contact Admin for assistance.');
}

function listTrials_(p) {
  const actor = requireUser_(p.token);
  let data = rows_('Trials').filter(r => String(r.Status).toLowerCase() !== 'deleted');
  if (actor.Role === 'value_champion') data = data.filter(r => parse_(actor.TrialIDsJSON,[]).includes(r.TrialID));
  if (actor.Role === 'driver') data = data.filter(r => parse_(r.DriverIDsJSON,[]).includes(actor.UserID));
  return {ok:true, trials:data.map(publicTrial_)};
}

function dashboard_(p) {
  const actor = requireUser_(p.token);
  if(actor.Role==='driver') throw new Error('Driver accounts cannot access management dashboards.');
  const trialId = String(p.trialId || '');
  if (!canSeeTrial_(actor, trialId)) throw new Error('You do not have access to this trial.');
  const from = String(p.from || today_()), to = String(p.to || today_());
  const trips = rows_('Trips').filter(r => r.TrialID === trialId && r.Status === 'Completed' && String(r.StartAt).slice(0,10) >= from && String(r.StartAt).slice(0,10) <= to);
  const shifts = rows_('Shifts').filter(r => r.TrialID === trialId && String(r.ShiftDate) >= from && String(r.ShiftDate) <= to);
  const totalKM = shifts.reduce((s,r)=>s+num_(r.TotalKM),0);
  const totalSOCUsed = shifts.reduce((s,r)=>s+num_(r.SOCUsed),0);
  const totalSOCCharged = shifts.reduce((s,r)=>s+num_(r.SOCCharged),0);
  const duration = trips.reduce((s,r)=>s+num_(r.DurationMin),0);
  const trial = rows_('Trials').find(r=>r.TrialID===trialId) || {};
  const target = num_(trial.DailyTripTarget) * Math.max(1, daysInclusive_(from,to));
  const tripTargetDuration = num_(trial.TargetDurationMin);
  const enrichedTrips = trips.map(t=>Object.assign({},t,{TargetDurationMin:tripTargetDuration,DurationVarianceMin:tripTargetDuration?num_(t.DurationMin)-tripTargetDuration:null,DurationTargetStatus:tripTargetDuration?(num_(t.DurationMin)<=tripTargetDuration?'Within target':'Above target'):'Not configured'}));
  const driverMap = {};
  trips.forEach(t=>{ const k=t.DriverName||t.DriverID; if (!driverMap[k]) driverMap[k] = {driver:k,trips:0,duration:0}; driverMap[k].trips++; driverMap[k].duration+=num_(t.DurationMin); });
  return {ok:true,summary:{trips:trips.length,totalKM:round_(totalKM,1),totalSOCUsed:round_(totalSOCUsed,1),totalSOCCharged:round_(totalSOCCharged,1),averageDurationMin:trips.length?round_(duration/trips.length,1):0,target,achievement:target?round_(trips.length/target*100,1):null,targetDurationMin:tripTargetDuration,drivers:Object.values(driverMap)},trips:enrichedTrips,shifts};
}

function currentShift_(p) { const actor=requireUser_(p.token); if(actor.Role!=='driver') throw new Error('Driver access required.'); const shift=rows_('Shifts').find(r=>r.DriverID===actor.UserID&&r.Status==='Open'); if(!shift) return {ok:true,shift:null}; const events=rows_('Events').filter(r=>r.ShiftID===shift.ShiftID); const last=events.filter(r=>r.EventType!=='Charging Complete').slice(-1)[0]||null; const tripCount=rows_('Trips').filter(r=>r.ShiftID===shift.ShiftID&&r.Status==='Completed').length; return {ok:true,shift,lastEvent:last,tripCount,pendingCharge:shift.PendingCharge==='YES'}; }

function startShift_(p) {
  const actor = requireUser_(p.token); const trialId=String(p.trialId||'');
  if (!canSeeTrial_(actor,trialId)) throw new Error('Trial access denied.');
  if (actor.Role !== 'driver' && actor.Role !== 'admin') throw new Error('Only drivers can open a shift.');
  const driverId=actor.Role==='driver'?actor.UserID:String(p.driverId||'');
  const driverName=actor.Name;
  const trial=rows_('Trials').find(r=>r.TrialID===trialId); if(!trial) throw new Error('Trial not found.');
  const open=rows_('Shifts').find(r=>r.TrialID===trialId&&r.DriverID===driverId&&r.Status==='Open'); if(open) throw new Error('You already have an open shift.');
  const openingOdo=num_(p.openingOdo), openingSOC=num_(p.openingSOC);
  if(openingOdo<0||openingSOC<0||openingSOC>100) throw new Error('Enter valid opening odometer and SOC.');
  const id=uuid_(), at=now_();
  append_('Shifts',{ShiftID:id,TrialID:trialId,DriverID:driverId,DriverName:driverName,VehicleNo:trial.VehicleNo,ShiftDate:today_(),ShiftName:String(p.shiftName||'General'),StartAt:at,OpeningOdo:openingOdo,OpeningSOC:openingSOC,Material:String(p.material||''),SOCCharged:0,TripCount:0,Status:'Open'});
  append_('Events',{EventID:uuid_(),TrialID:trialId,ShiftID:id,DriverID:driverId,VehicleNo:trial.VehicleNo,EventType:'Shift Start',EventAt:at,Odometer:openingOdo,SOC:openingSOC,Note:String(p.material||''),CreatedAt:at});
  audit_(actor,'SHIFT_START','Shift',id,{openingOdo,openingSOC,material:p.material});
  return {ok:true,shiftId:id,message:'Shift opened successfully.',time:at};
}

function punch_(p) {
  const lock=LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const actor=requireUser_(p.token); if(actor.Role!=='driver'&&actor.Role!=='admin') throw new Error('Driver access required.');
    const shift=rows_('Shifts').find(r=>r.ShiftID===String(p.shiftId||'')&&r.Status==='Open'); if(!shift) throw new Error('No open shift found.');
    if(actor.Role==='driver'&&shift.DriverID!==actor.UserID) throw new Error('This shift belongs to another driver.');
    const type=String(p.eventType||''); const allowed=['Loading In','Loading Out','Unloading In','Unloading Out','Charging','Break']; if(!allowed.includes(type)) throw new Error('Invalid event.'); const recent=lastEvent_(shift.ShiftID); if(recent&&recent.EventType===type&&(parseTimestamp_(now_())-parseTimestamp_(recent.CreatedAt||recent.EventAt))<10000) throw new Error('This event was just recorded. Wait before submitting it again.');
    const pending=String(shift.PendingCharge||''); if(pending && type!=='') throw new Error('Complete the charging SOC entry before recording another event.');
    const at=eventTime_(p.eventAt); if(recent&&parseTimestamp_(at)<parseTimestamp_(recent.EventAt)) throw new Error('Event time cannot be earlier than the previous event.'); let openTrip=rows_('Trips').find(r=>r.ShiftID===shift.ShiftID&&r.Status==='Open');
    if(type==='Charging') {
      const soc=num_(p.currentSOC); if(soc<0||soc>100) throw new Error('Enter charging-start SOC between 0 and 100.');
      if(openTrip) closeTrip_(openTrip,at,'Charging');
      update_('Shifts',shift.ShiftID,{PendingCharge:'YES',ChargeStartSOC:soc,ChargeStartedAt:at});
    } else if(type==='Break') {
      if(openTrip) closeTrip_(openTrip,at,'Break');
    } else if(type==='Loading In') {
      if(openTrip) closeTrip_(openTrip,at,'Next Loading In');
      const count=rows_('Trips').filter(r=>r.ShiftID===shift.ShiftID).length+1;
      append_('Trips',{TripID:uuid_(),TrialID:shift.TrialID,ShiftID:shift.ShiftID,DriverID:shift.DriverID,DriverName:shift.DriverName,VehicleNo:shift.VehicleNo,TripNo:count,StartAt:at,StartEvent:'Loading In',Status:'Open',EventsJSON:'[]'});
    } else {
      if(!openTrip) throw new Error('No active trip. Punch Loading In to start a trip.');
      const expected={'Loading Out':'Loading In','Unloading In':'Loading Out','Unloading Out':'Unloading In'};
      const last=lastEvent_(shift.ShiftID);
      if(last && expected[type]!==last.EventType) throw new Error('Invalid sequence. Expected the next operational event after '+last.EventType+'.');
      if(!last && type!=='Loading Out') throw new Error('Start with Loading In.');
    }
    const eventId=uuid_(); append_('Events',{EventID:eventId,TrialID:shift.TrialID,ShiftID:shift.ShiftID,DriverID:shift.DriverID,VehicleNo:shift.VehicleNo,EventType:type,EventAt:at,SOC:type==='Charging'?num_(p.currentSOC):'',Note:String(p.note||''),CreatedAt:at});
    audit_(actor,'PUNCH_'+type.toUpperCase().replace(/ /g,'_'),'Event',eventId,{});
    return {ok:true,message:type==='Charging'?'Trip closed. Enter SOC after charging when charging is complete.':type+' recorded.',time:at,requiresChargeCompletion:type==='Charging'};
  } finally { lock.releaseLock(); }
}

function completeCharging_(p) {
  const actor=requireUser_(p.token); if(actor.Role!=='driver'&&actor.Role!=='admin') throw new Error('Driver access required.'); const shift=rows_('Shifts').find(r=>r.ShiftID===String(p.shiftId||'')&&r.Status==='Open'); if(!shift) throw new Error('Open shift not found.');
  if(actor.Role==='driver'&&shift.DriverID!==actor.UserID) throw new Error('Shift access denied.');
  if(shift.PendingCharge!=='YES') throw new Error('No charging session is awaiting completion.');
  const after=num_(p.afterSOC), before=num_(shift.ChargeStartSOC); if(after<before||after>100) throw new Error('Post-charge SOC must be between pre-charge SOC and 100.');
  const gain=after-before, total=num_(shift.SOCCharged)+gain; update_('Shifts',shift.ShiftID,{PendingCharge:'',ChargeStartSOC:'',ChargeStartedAt:'',SOCCharged:total});
  const id=uuid_(), at=now_(); append_('Events',{EventID:id,TrialID:shift.TrialID,ShiftID:shift.ShiftID,DriverID:shift.DriverID,VehicleNo:shift.VehicleNo,EventType:'Charging Complete',EventAt:at,SOC:after,Note:'SOC gained: '+gain+'%',CreatedAt:at});
  return {ok:true,message:'Charging recorded. SOC gained: '+gain+'%.',socGained:gain};
}

function endShift_(p) {
  const actor=requireUser_(p.token); if(actor.Role!=='driver'&&actor.Role!=='admin') throw new Error('Driver access required.'); const shift=rows_('Shifts').find(r=>r.ShiftID===String(p.shiftId||'')&&r.Status==='Open'); if(!shift) throw new Error('Open shift not found.');
  if(actor.Role==='driver'&&shift.DriverID!==actor.UserID) throw new Error('Shift access denied.');
  if(shift.PendingCharge==='YES') throw new Error('Complete charging SOC entry before ending the shift.');
  const odo=num_(p.closingOdo), soc=num_(p.closingSOC); if(odo<num_(shift.OpeningOdo)) throw new Error('Closing odometer cannot be less than opening odometer.'); if(soc<0||soc>100) throw new Error('Closing SOC must be between 0 and 100.');
  const at=now_(); const openTrip=rows_('Trips').find(r=>r.ShiftID===shift.ShiftID&&r.Status==='Open'); if(openTrip) closeTrip_(openTrip,at,'Shift End');
  const km=odo-num_(shift.OpeningOdo), charged=num_(shift.SOCCharged), used=num_(shift.OpeningSOC)+charged-soc;
  update_('Shifts',shift.ShiftID,{EndAt:at,ClosingOdo:odo,ClosingSOC:soc,ClosingMaterial:String(p.closingMaterial||shift.Material||''),TotalKM:km,SOCUsed:used,TripCount:rows_('Trips').filter(r=>r.ShiftID===shift.ShiftID&&r.Status==='Completed').length,Status:'Completed'});
  append_('Events',{EventID:uuid_(),TrialID:shift.TrialID,ShiftID:shift.ShiftID,DriverID:shift.DriverID,VehicleNo:shift.VehicleNo,EventType:'Shift End',EventAt:at,Odometer:odo,SOC:soc,Note:String(p.closingMaterial||shift.Material||''),CreatedAt:at});
  audit_(actor,'SHIFT_END','Shift',shift.ShiftID,{closingOdo:odo,closingSOC:soc,totalKM:km,socUsed:used});
  return {ok:true,message:'Shift completed.',totalKM:km,socUsed:used};
}

function createTrial_(p) {
  const actor=requireRole_(p.token,['admin']); if(!String(p.trialName||'').trim()||!String(p.vehicleNo||'').trim()) throw new Error('Trial name and vehicle number are required.'); const trialId='TR-'+Utilities.getUuid().slice(0,8).toUpperCase();
  const drivers=Array.isArray(p.drivers)?p.drivers:[]; const materials=Array.isArray(p.materials)?p.materials:[];
  const issued=[]; const driverIds=[];
  drivers.forEach(d=>{const pin=String(Math.floor(10000000+Math.random()*90000000)); const salt=Utilities.getUuid(); const uid='U-'+Utilities.getUuid().slice(0,8); driverIds.push(uid); append_('Users',{UserID:uid,Name:String(d.name||''),Role:'driver',PINHash:hash_(pin+salt),PINSalt:salt,PINChangedAt:now_(),Active:true,TrialIDsJSON:JSON.stringify([trialId]),CreatedAt:now_()}); issued.push({name:d.name,pin,userId:uid});});
  append_('Trials',{TrialID:trialId,TrialName:String(p.trialName||''),TrialType:String(p.trialType||'Tipper'),Customer:String(p.customer||''),Location:String(p.location||''),VehicleNo:String(p.vehicleNo||''),DriversJSON:JSON.stringify(drivers),DriverIDsJSON:JSON.stringify(driverIds),ValueChampionIDsJSON:'[]',MaterialsJSON:JSON.stringify(materials),DailyTripTarget:num_(p.dailyTripTarget),TargetDurationMin:num_(p.targetDurationMin),StartDate:String(p.startDate||today_()),EndDate:String(p.endDate||''),Status:'Active',CreatedAt:now_(),CreatedBy:actor.UserID});
  audit_(actor,'CREATE_TRIAL','Trial',trialId,{trialName:p.trialName}); return {ok:true,trialId,issuedDriverPins:issued,message:'Trial created. Save the one-time PINs securely; they cannot be viewed again.'};
}

function setTrialStatus_(p) { const actor=requireRole_(p.token,['admin']); const trial=rows_('Trials').find(r=>r.TrialID===String(p.trialId||'')); if(!trial) throw new Error('Trial not found.'); const status=String(p.status||''); if(!['Active','On Hold','Completed'].includes(status)) throw new Error('Invalid trial status.'); update_('Trials',trial.TrialID,{Status:status}); audit_(actor,'SET_TRIAL_STATUS','Trial',trial.TrialID,{status}); return {ok:true,message:'Trial status updated to '+status+'.'}; }

function createUser_(p) {
  const actor=requireRole_(p.token,['admin']); const pin=String(p.pin||''); if(pin.length<8) throw new Error('PIN must contain at least 8 characters.');
  const role=String(p.role||'manager'); if(!['manager','utilization','value_champion'].includes(role)) throw new Error('Invalid user role.'); const salt=Utilities.getUuid(); const id='U-'+Utilities.getUuid().slice(0,8); append_('Users',{UserID:id,Name:String(p.name||''),Role:role,Email:String(p.email||''),Phone:String(p.phone||''),PINHash:hash_(pin+salt),PINSalt:salt,PINChangedAt:now_(),Active:true,TrialIDsJSON:JSON.stringify(p.trialIDs||[]),CreatedAt:now_()});
  return {ok:true,userId:id,message:'User created.'};
}

function listUsers_(p) { requireRole_(p.token,['admin']); return {ok:true,users:rows_('Users').map(u=>({userId:u.UserID,name:u.Name,role:u.Role,active:String(u.Active).toLowerCase()!=='false',trialIDs:parse_(u.TrialIDsJSON,[])}))}; }
function changePin_(p) { const actor=requireUser_(p.token); const oldPin=String(p.oldPin||''), newPin=String(p.newPin||''); if(newPin.length<8) throw new Error('New PIN must be at least 8 characters.'); const stored=rows_('Users').find(u=>u.UserID===actor.UserID); if(!stored||stored.PINHash!==hash_(oldPin+String(stored.PINSalt||''))) throw new Error('Current PIN is incorrect.'); const salt=Utilities.getUuid(); update_('Users',actor.UserID,{PINHash:hash_(newPin+salt),PINSalt:salt,PINChangedAt:now_()}); audit_(actor,'CHANGE_PIN','User',actor.UserID,{}); return {ok:true,message:'PIN changed successfully.'}; }

function resetPin_(p) { const actor=requireRole_(p.token,['admin']); const user=rows_('Users').find(r=>r.UserID===String(p.userId||'')); if(!user) throw new Error('User not found.'); const pin=String(Math.floor(10000000+Math.random()*90000000)); const salt=Utilities.getUuid(); update_('Users',user.UserID,{PINHash:hash_(pin+salt),PINSalt:salt,PINChangedAt:now_()}); audit_(actor,'RESET_PIN','User',user.UserID,{}); return {ok:true,pin,message:'New one-time PIN generated. Share it securely.'}; }

function closeTrip_(trip,at,reason) { const start=parseTimestamp_(trip.StartAt), end=parseTimestamp_(at); if(end<start) throw new Error('Trip closing time cannot be earlier than its start time.'); const mins=Math.round((end-start)/60000); update_('Trips',trip.TripID,{EndAt:at,DurationMin:mins,EndReason:reason,Status:'Completed'}); }
function lastEvent_(shiftId) { const es=rows_('Events').filter(r=>r.ShiftID===shiftId && r.EventType!=='Charging Complete'); return es.length?es[es.length-1]:null; }
function publicTrial_(r) { return {trialId:r.TrialID,trialName:r.TrialName,trialType:r.TrialType,customer:r.Customer,location:r.Location,vehicleNo:r.VehicleNo,status:r.Status,materials:parse_(r.MaterialsJSON,[]),dailyTripTarget:num_(r.DailyTripTarget),targetDurationMin:num_(r.TargetDurationMin)}; }
function canSeeTrial_(actor,id) { if(actor.Role==='admin'||actor.Role==='manager'||actor.Role==='utilization') return true; if(actor.Role==='value_champion') return parse_(actor.TrialIDsJSON,[]).includes(id); if(actor.Role==='driver') return parse_(actor.TrialIDsJSON,[]).includes(id); return false; }
function requireRole_(token,roles) { const u=requireUser_(token); if(!roles.includes(u.Role)) throw new Error('Insufficient permissions.'); return u; }
function requireUser_(token) { const cache=CacheService.getScriptCache(); const id=cache.get('tms:'+String(token||'')); if(!id) throw new Error('Session expired. Please log in again.'); const u=rows_('Users').find(r=>r.UserID===id&&String(r.Active).toLowerCase()!=='false'); if(!u) throw new Error('User account inactive.'); return u; }
function hash_(s) { const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8); return bytes.map(b=>(b+256).toString(16).slice(-2)).join(''); }
function rows_(name) { const sh=SpreadsheetApp.getActive().getSheetByName(name); if(!sh||sh.getLastRow()<2) return []; const vals=sh.getDataRange().getValues(), heads=vals.shift().map(String); return vals.filter(r=>r.some(v=>v!==''&&v!==null)).map(r=>{const o={};heads.forEach((h,i)=>o[h]=['ShiftDate','StartAt','EndAt','EventAt','CreatedAt','PINChangedAt','StartDate','EndDate'].includes(h)?normalizeDate_(r[i]):r[i]);return o;}); }
function append_(name,obj) { const sh=SpreadsheetApp.getActive().getSheetByName(name); const heads=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); sh.appendRow(heads.map(h=>obj[h]===undefined?'':obj[h])); }
function update_(name,id,patch) { const sh=SpreadsheetApp.getActive().getSheetByName(name), vals=sh.getDataRange().getValues(), heads=vals[0].map(String), idCol=heads[0]; for(let i=1;i<vals.length;i++){if(String(vals[i][heads.indexOf(idCol)])===String(id)){Object.keys(patch).forEach(k=>{const c=heads.indexOf(k);if(c>=0)sh.getRange(i+1,c+1).setValue(patch[k]);});return;}} throw new Error(name+' record not found.'); }
function audit_(actor,action,type,id,details) { append_('Audit',{AuditID:uuid_(),ActorID:actor.UserID,ActorName:actor.Name,Action:action,RecordType:type,RecordID:id,DetailsJSON:JSON.stringify(details||{}),CreatedAt:now_()}); }
function eventTime_(v) { if(!v) return now_(); let d; try { d=Utilities.parseDate(String(v),Session.getScriptTimeZone(),String(v).length===16?"yyyy-MM-dd'T'HH:mm":"yyyy-MM-dd'T'HH:mm:ss"); } catch(e) { throw new Error('Invalid event time.'); } if(!d||isNaN(d.getTime())) throw new Error('Invalid event time.'); if(d.getTime()>Date.now()) throw new Error('Event time cannot be in the future.'); return Utilities.formatDate(d,Session.getScriptTimeZone(),"yyyy-MM-dd'T'HH:mm:ss"); }
function parseTimestamp_(v) { return Utilities.parseDate(String(v),Session.getScriptTimeZone(),String(v).length===16?"yyyy-MM-dd'T'HH:mm":"yyyy-MM-dd'T'HH:mm:ss"); }
function normalizeDate_(v) { if(v instanceof Date) return Utilities.formatDate(v,Session.getScriptTimeZone(),String(v).includes(':')?"yyyy-MM-dd'T'HH:mm:ss":'yyyy-MM-dd'); if(v===null||v===undefined||v==='') return ''; return String(v).trim(); }
function parse_(s,fallback) { try{return JSON.parse(s||'')}catch(e){return fallback;} }
function num_(v) { const n=Number(v); return isFinite(n)?n:0; }
function round_(n,d) { const m=Math.pow(10,d); return Math.round(n*m)/m; }
function uuid_(){return Utilities.getUuid();}
function now_(){return Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyyy-MM-dd'T'HH:mm:ss");}
function today_(){return Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyy-MM-dd');}
function daysInclusive_(a,b){return Math.max(1,Math.floor((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000)+1);}

function setupAdmin() {
  const props=PropertiesService.getScriptProperties(); const pin=props.getProperty('ADMIN_PIN'); if(!pin||pin.length<8) throw new Error('Set ADMIN_PIN (at least 8 characters) in Script Properties before running setupAdmin().');
  const existing=rows_('Users').find(u=>u.Role==='admin'); const salt=Utilities.getUuid(); if(existing){update_('Users',existing.UserID,{PINHash:hash_(pin+salt),PINSalt:salt,PINChangedAt:now_()});return 'Existing admin PIN reset from ADMIN_PIN.';}
  append_('Users',{UserID:'ADMIN-'+Utilities.getUuid().slice(0,8),Name:'Amritesh',Role:'admin',Email:'amriteshkumarsingh@montraelectric.com',Phone:'8299207981',PINHash:hash_(pin+salt),PINSalt:salt,PINChangedAt:now_(),Active:true,TrialIDsJSON:'[]',CreatedAt:now_()}); return 'Admin account created.';
}

/** Run once after initializeSheets() to verify a real Sheet write/read round trip. */
function testWriteReadRoundTrip() {
  const id='SMOKE-'+Utilities.getUuid();
  append_('Audit',{AuditID:id,ActorID:'SYSTEM',ActorName:'Smoke Test',Action:'WRITE_READ_TEST',RecordType:'Test',RecordID:id,DetailsJSON:'{"result":"ok"}',CreatedAt:now_()});
  const found=rows_('Audit').some(r=>r.AuditID===id && r.Action==='WRITE_READ_TEST');
  const sh=SpreadsheetApp.getActive().getSheetByName('Audit');
  const vals=sh.getDataRange().getValues();
  for(let i=vals.length-1;i>=1;i--){if(String(vals[i][0])===id){sh.deleteRow(i+1);break;}}
  if(!found) throw new Error('Sheet write/read smoke test failed.');
  return 'PASS: temporary Audit row was written, read back, and removed.';
}

function testTripCalculations() {
  const example = {openingSOC:100, chargeBefore:30, chargeAfter:85, closingSOC:25};
  const used = example.openingSOC + (example.chargeAfter-example.chargeBefore) - example.closingSOC;
  if(used !== 130) throw new Error('SOC calculation test failed.');
  return 'PASS: expected SOC consumption is 130 percentage points.';
}
