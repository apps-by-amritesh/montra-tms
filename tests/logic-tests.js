const assert = require('node:assert/strict');
function allowedNext(sequence,lastType){
  const i=lastType?sequence.findIndex(x=>x.type===lastType):-1;
  if(i<0)return [sequence[0].type];
  const out=[];for(let n=i+1;n<sequence.length;n++){out.push(sequence[n].type);if(sequence[n].required)break;}
  return i===sequence.length-1?[sequence[0].type]:out;
}
function socUsed(open,charges,close){return open+charges.reduce((s,c)=>s+(c.after-c.before),0)-close;}
function energyKwh(socPoints,capacity,soh){return socPoints/100*capacity*soh/100;}
function duration(a,b){return Math.round((new Date(b)-new Date(a))/60000)}
const seq=[{type:'Loading In',required:true},{type:'Loading Out',required:false},{type:'Unloading In',required:false},{type:'Unloading Out',required:true}];
assert.deepEqual(allowedNext(seq,null),['Loading In']);
assert.deepEqual(allowedNext(seq,'Loading In'),['Loading Out','Unloading In','Unloading Out']);
assert.deepEqual(allowedNext(seq,'Loading Out'),['Unloading In','Unloading Out']);
assert.deepEqual(allowedNext(seq,'Unloading Out'),['Loading In']);
assert.equal(socUsed(100,[{before:30,after:85}],25),130);
assert.equal(energyKwh(130,300,90),351);
assert.equal(duration('2026-10-31T08:00:00','2026-10-31T09:15:00'),75);
assert.equal(duration('2026-10-31T09:30:00','2026-10-31T10:00:00'),30);
const plantDwell=duration('2026-10-31T08:00:00','2026-10-31T08:35:00');
const moveTime=duration('2026-10-31T08:35:00','2026-10-31T09:20:00');
assert.equal(plantDwell,35);
assert.equal(moveTime,45);
console.log('PASS: event sequence, optional skips, SOC, energy and duration, plant dwell and movement tests.');
