const test=require('node:test'); const assert=require('node:assert/strict');
const progress=require('../sql-progress.js');
const {validateProgress}=require('../api/progress.mjs');
test('a first correct answer earns XP once, including after reload and data variant',()=>{
 let s=progress.attempt(null,'s1-all','SELECT * FROM customers',{correct:true},0);
 assert.equal(progress.summary(s).xp,20);
 s=progress.attempt(JSON.parse(JSON.stringify(s)),'s1-all','SELECT * FROM customers',{correct:true},1);
 assert.equal(progress.summary(s).xp,20);assert.equal(s.records['s1-all'].attempts,2);
});
test('mistakes store the actual query and feedback, resolve later and can reopen',()=>{
 let s=progress.attempt(null,'s1-all','SELECT city FROM customers',{correct:false,error:'Verifică coloanele'},0);
 assert.equal(progress.summary(s).toReview,1);assert.equal(s.records['s1-all'].lastQuery,'SELECT city FROM customers');
 s=progress.attempt(s,'s1-all','SELECT * FROM customers',{correct:true},1);
 assert.equal(progress.summary(s).resolved,1); assert.equal(progress.summary(s).toReview,0);
 s=progress.attempt(s,'s1-all','SELECT id FROM customers',{correct:false,error:'Coloane'},0);
 assert.equal(progress.summary(s).toReview,1);assert.equal(progress.summary(s).xp,20);
});
test('cleaning removes unknown IDs and credentials and bounds saved text',()=>{
 const clean=progress.clean({activeExerciseId:'alien',records:{alien:{passed:true},'s1-all':{passed:true,lastQuery:'x'.repeat(9000),lastFeedback:'y'.repeat(9000),attempts:1e9,password:'secret'}}});
 assert.equal(clean.activeExerciseId,'s1-all');assert.deepEqual(Object.keys(clean.records),['s1-all']);
 assert.equal(clean.records['s1-all'].lastQuery.length,2000);assert.equal(clean.records['s1-all'].lastFeedback.length,600);
 assert.equal(JSON.stringify(clean).includes('secret'),false);
});
test('server progress persistence retains SQL attempts and rejects unbounded or foreign fields',()=>{
 const s=progress.attempt(null,'s5-left','SELECT 1',{correct:false,error:'JOIN'},1);
 const body=validateProgress({revision:null,course:{sqlPractice:s},vocabulary:{}});
 assert.deepEqual(body.course.sqlPractice,s);
 assert.equal(validateProgress({revision:null,course:{sqlPractice:{records:{unknown:{lastQuery:'bad'}}}}}).course.sqlPractice.records.unknown,undefined);
});
test('continuation and project progress count exercise identities rather than repeated answers',()=>{
 let s=progress.attempt(null,'p1','SELECT 1',{correct:true},0);
 s=progress.attempt(s,'p1','SELECT 1',{correct:true},0);
 assert.equal(progress.summary(s).projectDone,1);assert.equal(progress.summary(s).completed,1);
 assert.equal(progress.resume(s),'s1-all');
 assert.throws(()=>progress.attempt(s,'bad','SELECT 1',{correct:true},0));
});
test('resolved mistakes retain their original query and explanation after reload and persistence',()=>{
 let s=progress.attempt(null,'s3-stock','SELECT * FROM products',{correct:false,error:'Filtrează produsele fără stoc.'},1,'2026-11-14T10:00:00Z');
 s=progress.attempt(s,'s3-stock','SELECT * FROM products WHERE stock > 0',{correct:true},0,'2026-11-14T10:05:00Z');
 s=validateProgress({revision:0,course:{sqlPractice:JSON.parse(JSON.stringify(s))}}).course.sqlPractice;
 const r=s.records['s3-stock'];
 assert.equal(r.lastMistakeQuery,'SELECT * FROM products');
 assert.equal(r.lastMistakeFeedback,'Filtrează produsele fără stoc.');
 assert.equal(r.lastMistakeVariant,1);
 assert.equal(r.lastMistakeAt,'2026-11-14T10:00:00.000Z');
 assert.equal(r.lastFeedback,'Rezolvat corect.');
 assert.equal(progress.summary(s).resolved,1);
});
test('continuation returns to an active mistake even when the exercise was passed before',()=>{
 let s=progress.attempt(null,'s4-price','SELECT 1',{correct:true},0);
 s=progress.attempt(s,'s4-price','SELECT 2',{correct:false,error:'Ordinea diferă.'},1);
 assert.equal(progress.resume(s),'s4-price');
});
test('completion of the whole course offers an unresolved review before a repeat',()=>{
 let s=null;
 for(const id of progress.ids)s=progress.attempt(s,id,'SELECT 1',{correct:true},0);
 s=progress.attempt(s,'s5-left','SELECT 2',{correct:false,error:'Lipsesc clienți.'},1);
 s=progress.attempt(s,'p3','SELECT 1',{correct:true},0);
 assert.equal(progress.resume(s),'s5-left');
 assert.equal(progress.summary(s).xp,300);
});
test('existing pending mistakes migrate to bounded snapshots without inventing old resolved attempts',()=>{
 const pending=progress.clean({records:{'s1-all':{needsReview:true,hadMistake:true,lastQuery:'x'.repeat(3000),lastFeedback:'y'.repeat(800),lastAttemptAt:'2026-11-14T11:00:00Z',variant:1}}});
 assert.equal(pending.records['s1-all'].lastMistakeQuery.length,2000);
 assert.equal(pending.records['s1-all'].lastMistakeFeedback.length,600);
 assert.equal(pending.records['s1-all'].lastMistakeVariant,1);
 const oldResolved=progress.clean({records:{'s1-all':{passed:true,hadMistake:true,lastQuery:'SELECT * FROM customers',lastFeedback:'Rezolvat corect.'}}});
 assert.equal(oldResolved.records['s1-all'].lastMistakeQuery,'');
 assert.equal(oldResolved.records['s1-all'].lastMistakeAt,'');
});
