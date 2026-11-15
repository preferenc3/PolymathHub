const test=require('node:test'); const assert=require('node:assert/strict');
const L=require('../language-practice.js'); const {validateProgress}=require('../api/progress.mjs');
test('French practice checks each answer and accepts harmless typing variations',()=>{
 const r=L.check([' Acheter ','COMBIEN','combien']);assert.deepEqual(r.correct,[true,true,true]);assert.equal(r.passed,true);
 assert.deepEqual(L.check(['vendre','combien','prix']).correct,[false,true,false]);
});
test('language mistakes resolve and repeated practice earns XP only once',()=>{
 let s=L.attempt(null,['acheter','autre','']);assert.equal(s.needsReview,true);assert.equal(L.summary(s).xp,0);
 s=L.attempt(s,['acheter','combien','combien']);assert.equal(s.needsReview,false);assert.equal(s.hadMistake,true);assert.equal(L.summary(s).xp,20);
 s=L.attempt(JSON.parse(JSON.stringify(s)),['acheter','combien','combien']);assert.equal(L.summary(s).xp,20);assert.equal(s.attempts,3);
});
test('language state cleaning bounds text, drops extra fields and recomputes correctness',()=>{
 const s=L.clean({answers:['x'.repeat(1000),'combien','combien'],correct:[true,true,true],passed:true,password:'hidden',attempts:1e9});
 assert.equal(s.answers[0].length,100);assert.equal(s.correct[0],false);assert.equal(s.passed,false);assert.equal(JSON.stringify(s).includes('hidden'),false);
});
test('language progress survives the authenticated progress API validator',()=>{
 const s=L.attempt(null,['acheter','wrong','combien']);
 const safe=validateProgress({revision:null,course:{languagePractice:s,activeTrack:'Franceză'},vocabulary:{}});
 assert.deepEqual(safe.course.languagePractice,s);assert.equal(safe.course.activeTrack,'Franceză');
});
test('French feedback explains a missing word and the specific acheter/vendre confusion',()=>{
 const result=L.check(['vendre','','prix']);
 assert.match(result.feedback[0],/a vinde/);
 assert.match(result.feedback[1],/Completează/);
 assert.match(result.feedback[2],/substantiv/);
});
test('resolved French mistakes retain answers and explanations after server validation',()=>{
 let s=L.attempt(null,['vendre','combien','prix'],'2026-11-14T10:00:00Z');
 s=L.attempt(s,['acheter','combien','combien'],'2026-11-14T10:05:00Z');
 s=validateProgress({revision:0,course:{languagePractice:JSON.parse(JSON.stringify(s))}}).course.languagePractice;
 assert.deepEqual(s.lastMistakeAnswers,['vendre','combien','prix']);
 assert.equal(s.lastMistakeAt,'2026-11-14T10:00:00.000Z');
 assert.equal(L.summary(s).resolved,1);
 assert.equal(L.summary(s).xp,20);
});
test('a new French mistake reopens review without removing earned completion or XP',()=>{
 let s=L.attempt(null,['acheter','combien','combien']);
 s=L.attempt(s,['achète','combien','combien']);
 assert.equal(s.completed,true);assert.equal(s.needsReview,true);
 assert.equal(L.summary(s).xp,20);assert.equal(L.summary(s).resolved,0);
 assert.match(L.check(s.answers).feedback[0],/infinitiv/);
});
test('French snapshots stay bounded and legacy pending answers migrate correctly',()=>{
 const s=L.clean({answers:['vendre','combien','prix'],attempts:1,hadMistake:true,lastAttemptAt:'2026-11-14T11:00:00Z'});
 assert.deepEqual(s.lastMistakeAnswers,['vendre','combien','prix']);
 assert.equal(s.lastMistakeAt,'2026-11-14T11:00:00.000Z');
 const bounded=L.clean({...s,lastMistakeAnswers:['x'.repeat(300),42,'prix'],lastMistakeAt:'invalid'});
 assert.deepEqual(bounded.lastMistakeAnswers,['x'.repeat(100),'','prix']);
 assert.equal(bounded.lastMistakeAt,'');
});
test('a changed or cleared French draft is unverified without changing saved completion',()=>{
 const saved=L.attempt(null,['acheter','combien','combien']);
 assert.deepEqual(L.practiceStatus(saved,null),{verified:true,correct:3});
 assert.deepEqual(L.practiceStatus(saved,['acheter','combien','combien']),{verified:true,correct:3});
 assert.deepEqual(L.practiceStatus(saved,['','','']),{verified:false,correct:0});
 assert.deepEqual(L.practiceStatus(saved,['acheter','combien','prix']),{verified:false,correct:0});
 assert.equal(L.summary(saved).xp,20);assert.equal(saved.completed,true);
 assert.deepEqual(L.practiceStatus(null,null),{verified:false,correct:0});
});
